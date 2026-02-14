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

// Character glyph substitutions (ASCII, matching ESP32 terminal rendering)
const CHAR_GLYPHS = {
  ':pistol:': '*',
  ':phone:': '$',
  ':crystal:': '@',
  ':village:': 'V',
  ':lock:': '!',
  ':check:': '+',
  ':x:': '-',
  ':alpha:': 'A',
  ':pack:': 'P',
}

// Bitmap glyph XBM data (from PixelGlyph.jsx / ESP32 protocol.h)
const BITMAP_GLYPHS = {
  ':skull:': [0x3C, 0x7E, 0xFF, 0xDB, 0xFF, 0xFF, 0xBD, 0xA5],
  ':wolf:': [0x81, 0xC3, 0xFF, 0xDB, 0xFF, 0x7E, 0x3C, 0x18],
}

/**
 * Process a text string with :glyph: tokens into renderable segments
 * Returns array of { type: 'text', text } or { type: 'bitmap', bytes }
 */
function parseGlyphs(str) {
  if (!str) return []
  const segments = []
  let lastIndex = 0
  const regex = /:(\w+):/g
  let match

  while ((match = regex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: str.slice(lastIndex, match.index) })
    }
    const token = match[0]
    if (BITMAP_GLYPHS[token]) {
      segments.push({ type: 'bitmap', bytes: BITMAP_GLYPHS[token] })
    } else if (CHAR_GLYPHS[token]) {
      segments.push({ type: 'text', text: CHAR_GLYPHS[token] })
    } else {
      segments.push({ type: 'text', text: token })
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < str.length) {
    segments.push({ type: 'text', text: str.slice(lastIndex) })
  }
  return segments
}

/**
 * Measure the pixel width of parsed segments
 */
function measureSegments(segments, font) {
  let w = 0
  for (const seg of segments) {
    if (seg.type === 'bitmap') {
      w += 8 // 8px wide bitmap glyph
    } else {
      w += seg.text.length * font.width
    }
  }
  return w
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
 * Draw an 8x8 XBM bitmap at (x, baselineY) vertically centered on the font
 */
function drawBitmap(ctx, bytes, x, baselineY, font) {
  // Center the 8px tall bitmap on the font's ascent area
  const topY = baselineY - font.baseline + Math.floor((font.height - 8) / 2)
  for (let row = 0; row < 8; row++) {
    const byte = bytes[row]
    if (byte === 0) continue
    for (let bit = 7; bit >= 0; bit--) {
      if (byte & (1 << bit)) {
        ctx.fillRect(x + (7 - bit), topY + row, 1, 1)
      }
    }
  }
}

/**
 * Draw parsed segments starting at x, return total width drawn
 */
function drawSegments(ctx, segments, x, baselineY, font) {
  let cx = x
  for (const seg of segments) {
    if (seg.type === 'bitmap') {
      drawBitmap(ctx, seg.bytes, cx, baselineY, font)
      cx += 8
    } else {
      drawText(ctx, seg.text, cx, baselineY, font)
      cx += seg.text.length * font.width
    }
  }
  return cx - x
}

/**
 * Draw an 18x18 XBM icon at (x, y)
 * XBM format: 3 bytes per row, LSB = leftmost pixel, only 18 bits used
 */
function drawIcon(ctx, iconId, x, y) {
  const bytes = Icons[iconId]
  if (!bytes) return

  ctx.fillStyle = ICON_COLOR
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
function renderDisplay(ctx, display, color) {
  const { line1, line2, line3, icons } = display
  const isLocked = line2.style === 'locked'

  // === ICON COLUMN ===
  if (icons && icons.length === 3) {
    for (let i = 0; i < 3; i++) {
      const icon = icons[i]
      if (icon && icon.id) {
        drawIcon(ctx, icon.id, ICON_COL_X, ICON_Y[i])
      }
    }
    // Draw selection bar next to the active icon slot
    const idleIdx = display.idleScrollIndex
    if (idleIdx !== undefined && idleIdx >= 0 && idleIdx <= 2) {
      drawSelectionBar(ctx, idleIdx, color)
    }
  }

  // Set draw color for text
  ctx.fillStyle = color

  // === LINE 1: small font, left + right ===
  const l1Left = parseGlyphs(line1.left)
  const l1Right = parseGlyphs(line1.right)

  drawSegments(ctx, l1Left, MARGIN_X, LINE1_Y, FONT_6x10)

  if (l1Right.length > 0) {
    const rightW = measureSegments(l1Right, FONT_6x10)
    drawSegments(ctx, l1Right, TEXT_AREA_W - MARGIN_X - rightW, LINE1_Y, FONT_6x10)
  }

  // === LINE 2: large font, centered within text area ===
  const l2Segs = parseGlyphs(line2.text)
  const l2W = measureSegments(l2Segs, FONT_10x20)
  const l2X = Math.floor((TEXT_AREA_W - l2W) / 2)

  if (isLocked) {
    // Brighter color for locked
    ctx.fillStyle = COLOR_BRIGHT
    // Draw frame around text (matching ESP32 drawFrame)
    const frameX = l2X - 4
    const frameY = LINE2_Y - 18
    const frameW = l2W + 8
    const frameH = 22
    // Top edge
    ctx.fillRect(frameX, frameY, frameW, 1)
    // Bottom edge
    ctx.fillRect(frameX, frameY + frameH - 1, frameW, 1)
    // Left edge
    ctx.fillRect(frameX, frameY, 1, frameH)
    // Right edge
    ctx.fillRect(frameX + frameW - 1, frameY, 1, frameH)
  }

  drawSegments(ctx, l2Segs, l2X, LINE2_Y, FONT_10x20)

  // Reset color after locked
  if (isLocked) {
    ctx.fillStyle = color
  }

  // === LINE 3: small font, centered or left/right within text area ===
  const hasLine3Split = line3.left || line3.right

  if (hasLine3Split) {
    const l3Left = parseGlyphs(line3.left)
    const l3Right = parseGlyphs(line3.right)

    drawSegments(ctx, l3Left, MARGIN_X, LINE3_Y, FONT_6x10)

    if (line3.center) {
      const l3Center = parseGlyphs(line3.center)
      const centerW = measureSegments(l3Center, FONT_6x10)
      drawSegments(ctx, l3Center, Math.floor((TEXT_AREA_W - centerW) / 2), LINE3_Y, FONT_6x10)
    }

    if (l3Right.length > 0) {
      const rightW = measureSegments(l3Right, FONT_6x10)
      drawSegments(ctx, l3Right, TEXT_AREA_W - MARGIN_X - rightW, LINE3_Y, FONT_6x10)
    }
  } else {
    const l3Segs = parseGlyphs(line3.text)
    const l3W = measureSegments(l3Segs, FONT_6x10)
    const l3X = Math.floor((TEXT_AREA_W - l3W) / 2)
    drawSegments(ctx, l3Segs, l3X, LINE3_Y, FONT_6x10)
  }
}

/**
 * TinyScreen - Canvas-based three-line display component
 * Renders at native 256x64, scaled up with pixelated rendering for visible pixel grid
 */
export default function TinyScreen({ display, compact = false }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)

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
      // Animate: pulse line2
      let startTime = null
      const animate = (timestamp) => {
        if (startTime === null) startTime = timestamp
        const elapsed = timestamp - startTime
        renderFrame(canvas, style, elapsed)
        animRef.current = requestAnimationFrame(animate)
      }
      animRef.current = requestAnimationFrame(animate)
      return () => {
        if (animRef.current) cancelAnimationFrame(animRef.current)
      }
    } else {
      // Static render
      renderFrame(canvas, style)
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
