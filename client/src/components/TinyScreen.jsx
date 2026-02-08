// client/src/components/TinyScreen.jsx
// Three-line display for player terminals
// Canvas-based rendering at native 256x64, matching ESP32 SSD1322 OLED pixel-for-pixel

import { useRef, useEffect, useCallback } from 'react'
import { FONT_6x10, FONT_10x20 } from './oledFonts.js'
import styles from './TinyScreen.module.css'

// Display dimensions (matching SSD1322 OLED)
const W = 256
const H = 64

// Layout constants (matching ESP32 display.cpp)
const LINE1_Y = 12   // Baseline for line 1
const LINE2_Y = 42   // Baseline for line 2
const LINE3_Y = 60   // Baseline for line 3
const MARGIN_X = 4

// Amber palette
const COLOR_NORMAL = '#ffb000'
const COLOR_BRIGHT = '#ffc840'
const COLOR_DIM = '#805800'
const COLOR_BG = '#0a0800'

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
 * Render the full 3-line display onto a canvas context
 */
function renderDisplay(ctx, display, color) {
  const { line1, line2, line3 } = display
  const isLocked = line2.style === 'locked'

  // Set draw color
  ctx.fillStyle = color

  // === LINE 1: small font, left + right ===
  const l1Left = parseGlyphs(line1.left)
  const l1Right = parseGlyphs(line1.right)

  drawSegments(ctx, l1Left, MARGIN_X, LINE1_Y, FONT_6x10)

  if (l1Right.length > 0) {
    const rightW = measureSegments(l1Right, FONT_6x10)
    drawSegments(ctx, l1Right, W - MARGIN_X - rightW, LINE1_Y, FONT_6x10)
  }

  // === LINE 2: large font, centered ===
  const l2Segs = parseGlyphs(line2.text)
  const l2W = measureSegments(l2Segs, FONT_10x20)
  const l2X = Math.floor((W - l2W) / 2)

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

  // === LINE 3: small font, centered or left/right ===
  const hasLine3Split = line3.left || line3.right

  if (hasLine3Split) {
    const l3Left = parseGlyphs(line3.left)
    const l3Right = parseGlyphs(line3.right)

    drawSegments(ctx, l3Left, MARGIN_X, LINE3_Y, FONT_6x10)

    if (l3Right.length > 0) {
      const rightW = measureSegments(l3Right, FONT_6x10)
      drawSegments(ctx, l3Right, W - MARGIN_X - rightW, LINE3_Y, FONT_6x10)
    }
  } else {
    const l3Segs = parseGlyphs(line3.text)
    const l3W = measureSegments(l3Segs, FONT_6x10)
    const l3X = Math.floor((W - l3W) / 2)
    drawSegments(ctx, l3Segs, l3X, LINE3_Y, FONT_6x10)
  }
}

/**
 * TinyScreen - Canvas-based three-line display component
 * Renders at native 256x64, scaled up with pixelated rendering for visible pixel grid
 *
 * Props:
 *   display: {
 *     line1: { left: string, right: string },
 *     line2: { text: string, style: 'normal'|'locked'|'abstained'|'waiting' },
 *     line3: { text: string } OR { left: string, right: string },
 *     leds: { yes: string, no: string }
 *   }
 *   compact: boolean (for debug grid)
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
      const t = (Math.sin(time / 1000 * Math.PI) + 1) / 2 // 0→1→0 over 2s
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
