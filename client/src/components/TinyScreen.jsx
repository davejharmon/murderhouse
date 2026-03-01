// client/src/components/TinyScreen.jsx
// Three-line display for player terminals
// Canvas-based rendering at native 256x64, matching ESP32 SSD1322 OLED pixel-for-pixel

import { useRef, useEffect, useCallback } from 'react'
import { FONT_6x10, FONT_10x20 } from './oledFonts.js'
import { Icons } from '@shared/icons.js'
import styles from './TinyScreen.module.css'

// Display dimensions (matching SSD1322 OLED)
const W = 256
const H = 64

// Layout constants (matching ESP32 display.cpp)
const LINE1_Y = 12   // Baseline for line 1
const LINE2_Y = 42   // Baseline for line 2
const LINE3_Y = 60   // Baseline for line 3
const MARGIN_X = 4

// Icon column layout (2px whitespace gap between text area and icons)
const TEXT_AREA_W = 234   // Width of text area
const ICON_COL_X = 236    // Start of icon column
const ICON_SIZE = 18      // 18x18 icons
const ICON_SLOT_H = 20    // 20px per slot (18px icon + centering)
const ICON_Y = [1, 23, 45] // Y positions for 3 icons (centered in 20px slots)
const SLOT_Y = [0, 22, 44] // Y positions for 3 slots (for bar indicator)
const BAR_X = 254          // X position of selection bar (2px wide, 254..255)
const BAR_W = 2            // Width of selection bar

// Amber palette
const COLOR_NORMAL = '#ffb000'
const COLOR_BRIGHT = '#ffc840'
const COLOR_DIM = '#805800'
const COLOR_VDIM = '#2a1800'
const COLOR_BG = '#0a0800'

// Icon color (all icons drawn at same brightness; selection shown via bar)
const ICON_COLOR = COLOR_NORMAL

/**
 * Measure the pixel width of a text string
 */
function measureText(str, font) {
  return (str || '').length * font.width
}

/**
 * Draw a single character glyph onto canvas at (x, baselineY) using the given font
 */
function drawChar(ctx, charCode, x, baselineY, font) {
  const glyph = font.glyphs[charCode]
  if (!glyph) return

  const topY = baselineY - font.baseline

  if (font.width <= 8) {
    // 6x10: each row is a byte, top bits are pixels
    for (let row = 0; row < font.height; row++) {
      const byte = glyph[row]
      if (byte === 0) continue
      for (let bit = 7; bit >= (8 - font.width); bit--) {
        if (byte & (1 << bit)) {
          ctx.fillRect(x + (7 - bit), topY + row, 1, 1)
        }
      }
    }
  } else {
    // 10x20: each row is a uint16, top bits are pixels
    for (let row = 0; row < font.height; row++) {
      const word = glyph[row]
      if (word === 0) continue
      for (let bit = 15; bit >= (16 - font.width); bit--) {
        if (word & (1 << bit)) {
          ctx.fillRect(x + (15 - bit), topY + row, 1, 1)
        }
      }
    }
  }
}

/**
 * Draw a text string at (x, baselineY) using the given font
 */
function drawText(ctx, text, x, baselineY, font) {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code >= 32 && code <= 126) {
      drawChar(ctx, code, x + i * font.width, baselineY, font)
    }
  }
}

/**
 * Draw an 18x18 XBM icon at (x, y) with optional color override
 * XBM format: 3 bytes per row, LSB = leftmost pixel, only 18 bits used
 */
function drawIcon(ctx, iconId, x, y, color = ICON_COLOR) {
  const bytes = Icons[iconId]
  if (!bytes) return

  ctx.fillStyle = color
  for (let row = 0; row < ICON_SIZE; row++) {
    const b0 = bytes[row * 3]
    const b1 = bytes[row * 3 + 1]
    const b2 = bytes[row * 3 + 2]
    for (let bit = 0; bit < ICON_SIZE; bit++) {
      let byteIdx, bitIdx
      if (bit < 8) {
        byteIdx = b0
        bitIdx = bit
      } else if (bit < 16) {
        byteIdx = b1
        bitIdx = bit - 8
      } else {
        byteIdx = b2
        bitIdx = bit - 16
      }
      if (byteIdx & (1 << bitIdx)) {
        ctx.fillRect(x + bit, y + row, 1, 1)
      }
    }
  }
}

/**
 * Draw the selection bar indicator at the active icon slot
 */
function drawSelectionBar(ctx, activeIndex, color) {
  if (activeIndex < 0 || activeIndex > 2) return
  ctx.fillStyle = color
  ctx.fillRect(BAR_X, SLOT_Y[activeIndex], BAR_W, ICON_SLOT_H)
}

/**
 * Render the full 3-line display with icon column onto a canvas context
 */
function renderDisplay(ctx, display, color, line2Color = null, iconColors = null) {
  const { line1, line2, line3, icons } = display
  const isLocked = line2.style === 'locked'

  // Effective line 2 color: explicit override → locked bright → base color
  const l2Color = line2Color !== null ? line2Color
    : isLocked ? COLOR_BRIGHT
    : color

  // === ICON COLUMN ===
  if (icons && icons.length === 3) {
    for (let i = 0; i < 3; i++) {
      const icon = icons[i]
      if (icon && icon.id) {
        const slotColor = (iconColors && iconColors[i] != null) ? iconColors[i] : ICON_COLOR
        drawIcon(ctx, icon.id, ICON_COL_X, ICON_Y[i], slotColor)
      }
    }
    // Draw selection bar next to the active icon slot (only if 2+ icons visible)
    const visibleCount = icons.filter(ic => ic && ic.id && ic.id !== 'empty').length
    const idleIdx = display.idleScrollIndex
    if (visibleCount >= 2 && idleIdx !== undefined && idleIdx >= 0 && idleIdx <= 2) {
      drawSelectionBar(ctx, idleIdx, color)
    }
  }

  // Set draw color for text
  ctx.fillStyle = color

  // === LINE 1: small font, left + right ===
  if (line1.left) {
    drawText(ctx, line1.left, MARGIN_X, LINE1_Y, FONT_6x10)
  }
  if (line1.right) {
    const rightW = measureText(line1.right, FONT_6x10)
    drawText(ctx, line1.right, TEXT_AREA_W - MARGIN_X - rightW, LINE1_Y, FONT_6x10)
  }

  // === LINE 2: large font, centered within text area ===
  const l2W = measureText(line2.text, FONT_10x20)
  const l2X = Math.floor((TEXT_AREA_W - l2W) / 2)

  ctx.fillStyle = l2Color
  if (isLocked) {
    // Draw frame around text (matching ESP32 drawFrame)
    const frameX = l2X - 4
    const frameY = LINE2_Y - 18
    const frameW = l2W + 8
    const frameH = 22
    ctx.fillRect(frameX, frameY, frameW, 1)
    ctx.fillRect(frameX, frameY + frameH - 1, frameW, 1)
    ctx.fillRect(frameX, frameY, 1, frameH)
    ctx.fillRect(frameX + frameW - 1, frameY, 1, frameH)
  }

  drawText(ctx, line2.text, l2X, LINE2_Y, FONT_10x20)

  // Reset to base color for line 3
  ctx.fillStyle = color

  // === LINE 3: small font, centered or left/right within text area ===
  const hasLine3Split = line3.left || line3.right

  if (hasLine3Split) {
    if (line3.left) {
      drawText(ctx, line3.left, MARGIN_X, LINE3_Y, FONT_6x10)
    }
    if (line3.center) {
      const centerW = measureText(line3.center, FONT_6x10)
      drawText(ctx, line3.center, Math.floor((TEXT_AREA_W - centerW) / 2), LINE3_Y, FONT_6x10)
    }
    if (line3.right) {
      const rightW = measureText(line3.right, FONT_6x10)
      drawText(ctx, line3.right, TEXT_AREA_W - MARGIN_X - rightW, LINE3_Y, FONT_6x10)
    }
  } else {
    const l3W = measureText(line3.text, FONT_6x10)
    const l3X = Math.floor((TEXT_AREA_W - l3W) / 2)
    drawText(ctx, line3.text, l3X, LINE3_Y, FONT_6x10)
  }
}

/**
 * TinyScreen - Canvas-based three-line display component
 * Renders at native 256x64, scaled up with pixelated rendering for visible pixel grid
 */
export default function TinyScreen({ display, compact = false }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const criticalPlayedRef = useRef(false)
  const prevIconsRef = useRef(null)   // previous icon state for change detection
  const iconBlinkRef = useRef({})     // { slotIndex: startTimestamp } for active blinks

  const renderFrame = useCallback((canvas, style, time) => {
    if (!canvas || !display) return
    const ctx = canvas.getContext('2d')

    // Clear to OLED background
    ctx.fillStyle = COLOR_BG
    ctx.fillRect(0, 0, W, H)

    // Determine draw color based on style
    let color = COLOR_NORMAL
    if (style === 'abstained') {
      color = COLOR_DIM
    } else if (style === 'waiting' && time !== undefined) {
      // Pulse between dim and normal over 2s
      const t = (Math.sin(time / 1000 * Math.PI) + 1) / 2 // 0->1->0 over 2s
      const r = Math.round(0x80 + (0xff - 0x80) * t)
      const g = Math.round(0x58 + (0xb0 - 0x58) * t)
      const b = Math.round(0x00)
      color = `rgb(${r},${g},${b})`
    }

    renderDisplay(ctx, display, color)
  }, [display])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // === Detect icon changes → queue per-slot blinks ===
    if (display) {
      const currentIcons = display.icons || []
      if (prevIconsRef.current !== null) {
        const now = performance.now()
        for (let i = 0; i < 3; i++) {
          const prevId = prevIconsRef.current[i]?.id || 'empty'
          const currId = currentIcons[i]?.id || 'empty'
          if (currId !== prevId && currId !== 'empty') {
            iconBlinkRef.current[i] = now
          }
        }
      }
      prevIconsRef.current = currentIcons
    } else {
      prevIconsRef.current = null
    }

    if (!display) {
      // No display data — show connecting message
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = COLOR_BG
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = COLOR_DIM
      drawText(ctx, 'CONNECTING', MARGIN_X, LINE1_Y, FONT_6x10)
      drawText(ctx, '...', Math.floor((W - 3 * FONT_10x20.width) / 2), LINE2_Y, FONT_10x20)
      const waitText = 'Please wait'
      const waitW = waitText.length * FONT_6x10.width
      drawText(ctx, waitText, Math.floor((W - waitW) / 2), LINE3_Y, FONT_6x10)
      return
    }

    const style = display.line2.style

    if (style === 'waiting') {
      // Continuous pulse for line 2 — icon blinks deferred until state changes
      let startTime = null
      const animate = (timestamp) => {
        if (startTime === null) startTime = timestamp
        renderFrame(canvas, style, timestamp - startTime)
        animRef.current = requestAnimationFrame(animate)
      }
      animRef.current = requestAnimationFrame(animate)
      return () => {
        if (animRef.current) cancelAnimationFrame(animRef.current)
      }
    }

    // Determine what needs animating
    const needsLineBlink = style === 'critical' && !criticalPlayedRef.current
    const hasIconBlinks = Object.keys(iconBlinkRef.current).length > 0

    // Update critical tracking
    if (style !== 'critical') {
      criticalPlayedRef.current = false
    } else if (needsLineBlink) {
      criticalPlayedRef.current = true
    }

    if (!needsLineBlink && !hasIconBlinks) {
      // Static render — no animation needed
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = COLOR_BG
      ctx.fillRect(0, 0, W, H)
      renderDisplay(ctx, display, COLOR_NORMAL, style === 'critical' ? COLOR_BRIGHT : null)
      return
    }

    // Unified animation loop: line 2 blink and/or icon slot blinks
    const HALF_CYCLE = 150
    const TOTAL_BLINK_MS = HALF_CYCLE * 2 * 3 // 3 cycles

    let animStartTime = null
    const animate = (timestamp) => {
      if (animStartTime === null) animStartTime = timestamp
      const elapsed = timestamp - animStartTime

      const ctx = canvas.getContext('2d')
      ctx.fillStyle = COLOR_BG
      ctx.fillRect(0, 0, W, H)

      // Line 2 color
      let l2Color = null
      if (style === 'critical') {
        if (!needsLineBlink || elapsed >= TOTAL_BLINK_MS) {
          l2Color = COLOR_BRIGHT // settled
        } else {
          l2Color = Math.floor(elapsed / HALF_CYCLE) % 2 === 0 ? COLOR_BRIGHT : COLOR_BG
        }
      }

      // Per-slot icon colors (null = default ICON_COLOR)
      const iconColors = [null, null, null]
      let stillBlinking = false
      for (const slotStr of Object.keys(iconBlinkRef.current)) {
        const slot = parseInt(slotStr)
        const slotElapsed = timestamp - iconBlinkRef.current[slot]
        if (slotElapsed >= TOTAL_BLINK_MS) {
          delete iconBlinkRef.current[slot]
        } else {
          stillBlinking = true
          iconColors[slot] = Math.floor(slotElapsed / HALF_CYCLE) % 2 === 0 ? COLOR_BRIGHT : COLOR_BG
        }
      }

      renderDisplay(ctx, display, COLOR_NORMAL, l2Color, iconColors)

      const l2Done = !needsLineBlink || elapsed >= TOTAL_BLINK_MS
      if (l2Done && !stillBlinking) return
      animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [display, renderFrame])

  const styleClass = display?.line2?.style === 'locked' ? styles.locked
    : display?.line2?.style === 'waiting' ? styles.waiting
    : ''

  return (
    <div className={`${styles.screen} ${styleClass} ${compact ? styles.compact : ''}`}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className={styles.canvas}
      />
    </div>
  )
}
