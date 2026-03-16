// tools/export-screens.mjs
// Renders TinyScreen displays to BMP files at native 256x64 resolution
// Usage: node tools/export-screens.mjs

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { deflateSync } from 'zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const EXPORT_DIR = join(__dirname, '..', 'exports')

// Import shared data
const { FONT_6x10, FONT_10x20 } = await import('../client/src/components/oledFonts.js')
const { Icons } = await import('../shared/icons.js')

// ── Display constants (matching TinyScreen.jsx) ─────────────────────────────
const W = 256, H = 64
const LINE1_Y = 12, LINE2_Y = 42, LINE3_Y = 60
const MARGIN_X = 4
const TEXT_AREA_W = 234, ICON_COL_X = 236
const ICON_SIZE = 18
const ICON_Y = [1, 23, 45]
const SLOT_Y = [0, 22, 44]
const ICON_SLOT_H = 20
const BAR_X = 254, BAR_W = 2

// Colors as [R, G, B]
const COLOR_NORMAL = [255, 176, 0]
const COLOR_BRIGHT = [255, 200, 64]
const COLOR_DIM    = [128, 88, 0]
const COLOR_BG     = [10, 8, 0]

// ── Pixel buffer ────────────────────────────────────────────────────────────

function createBuffer(w, h) {
  return { w, h, data: new Uint8Array(w * h * 3).fill(0) }
}

function setPixel(buf, x, y, color) {
  if (x < 0 || x >= buf.w || y < 0 || y >= buf.h) return
  const i = (y * buf.w + x) * 3
  buf.data[i] = color[0]
  buf.data[i + 1] = color[1]
  buf.data[i + 2] = color[2]
}

function fillRect(buf, x, y, w, h, color) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      setPixel(buf, x + dx, y + dy, color)
}

function clearBuffer(buf, color) {
  fillRect(buf, 0, 0, buf.w, buf.h, color)
}

// ── Text rendering ──────────────────────────────────────────────────────────

function measureText(str, font) {
  return (str || '').length * font.width
}

function drawChar(buf, charCode, x, baselineY, font, color) {
  const glyph = font.glyphs[charCode]
  if (!glyph) return
  const topY = baselineY - font.baseline

  if (font.width <= 8) {
    for (let row = 0; row < font.height; row++) {
      const byte = glyph[row]
      if (byte === 0) continue
      for (let bit = 7; bit >= (8 - font.width); bit--) {
        if (byte & (1 << bit)) setPixel(buf, x + (7 - bit), topY + row, color)
      }
    }
  } else {
    for (let row = 0; row < font.height; row++) {
      const word = glyph[row]
      if (word === 0) continue
      for (let bit = 15; bit >= (16 - font.width); bit--) {
        if (word & (1 << bit)) setPixel(buf, x + (15 - bit), topY + row, color)
      }
    }
  }
}

function drawText(buf, text, x, baselineY, font, color) {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code >= 32 && code <= 126) {
      drawChar(buf, code, x + i * font.width, baselineY, font, color)
    }
  }
}

// ── Icon rendering ──────────────────────────────────────────────────────────

function drawIcon(buf, iconId, x, y, color = COLOR_NORMAL) {
  const bytes = Icons[iconId]
  if (!bytes) return
  for (let row = 0; row < ICON_SIZE; row++) {
    const b0 = bytes[row * 3], b1 = bytes[row * 3 + 1], b2 = bytes[row * 3 + 2]
    for (let bit = 0; bit < ICON_SIZE; bit++) {
      let byteVal, bitIdx
      if (bit < 8) { byteVal = b0; bitIdx = bit }
      else if (bit < 16) { byteVal = b1; bitIdx = bit - 8 }
      else { byteVal = b2; bitIdx = bit - 16 }
      if (byteVal & (1 << bitIdx)) setPixel(buf, x + bit, y + row, color)
    }
  }
}

function drawSelectionBar(buf, activeIndex, color) {
  if (activeIndex < 0 || activeIndex > 2) return
  fillRect(buf, BAR_X, SLOT_Y[activeIndex], BAR_W, ICON_SLOT_H, color)
}

// ── Full display render ─────────────────────────────────────────────────────

function renderDisplay(buf, display, color = COLOR_NORMAL) {
  const { line1, line2, line3, icons } = display
  const isLocked = line2.style === 'locked'
  const l2Color = isLocked ? COLOR_BRIGHT : color

  // Icons
  if (icons && icons.length === 3) {
    for (let i = 0; i < 3; i++) {
      const icon = icons[i]
      if (icon && icon.id && icon.id !== 'empty') {
        drawIcon(buf, icon.id, ICON_COL_X, ICON_Y[i], COLOR_NORMAL)
      }
    }
    const visibleCount = icons.filter(ic => ic && ic.id && ic.id !== 'empty').length
    const idleIdx = display.idleScrollIndex
    if (visibleCount >= 2 && idleIdx !== undefined && idleIdx >= 0 && idleIdx <= 2) {
      drawSelectionBar(buf, idleIdx, color)
    }
  }

  // Line 1
  if (line1.left) drawText(buf, line1.left, MARGIN_X, LINE1_Y, FONT_6x10, color)
  if (line1.right) {
    const rightW = measureText(line1.right, FONT_6x10)
    drawText(buf, line1.right, TEXT_AREA_W - MARGIN_X - rightW, LINE1_Y, FONT_6x10, color)
  }

  // Line 2
  const l2W = measureText(line2.text, FONT_10x20)
  const l2X = Math.floor((TEXT_AREA_W - l2W) / 2)
  if (isLocked) {
    const frameX = l2X - 4, frameY = LINE2_Y - 18, frameW = l2W + 8, frameH = 22
    fillRect(buf, frameX, frameY, frameW, 1, l2Color)
    fillRect(buf, frameX, frameY + frameH - 1, frameW, 1, l2Color)
    fillRect(buf, frameX, frameY, 1, frameH, l2Color)
    fillRect(buf, frameX + frameW - 1, frameY, 1, frameH, l2Color)
  }
  drawText(buf, line2.text, l2X, LINE2_Y, FONT_10x20, l2Color)

  // Line 3
  const hasLine3Split = line3.left || line3.right
  if (hasLine3Split) {
    if (line3.left) drawText(buf, line3.left, MARGIN_X, LINE3_Y, FONT_6x10, color)
    if (line3.center) {
      const cw = measureText(line3.center, FONT_6x10)
      drawText(buf, line3.center, Math.floor((TEXT_AREA_W - cw) / 2), LINE3_Y, FONT_6x10, color)
    }
    if (line3.right) {
      const rw = measureText(line3.right, FONT_6x10)
      drawText(buf, line3.right, TEXT_AREA_W - MARGIN_X - rw, LINE3_Y, FONT_6x10, color)
    }
  } else if (line3.text) {
    const l3W = measureText(line3.text, FONT_6x10)
    const l3X = Math.floor((TEXT_AREA_W - l3W) / 2)
    drawText(buf, line3.text, l3X, LINE3_Y, FONT_6x10, color)
  }
}

// ── PNG writer (minimal, using zlib) ────────────────────────────────────────

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData), 0)
  return Buffer.concat([len, typeAndData, crc])
}

function writePNG(filename, buf) {
  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(buf.w, 0)
  ihdr.writeUInt32BE(buf.h, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 2   // color type: RGB
  ihdr[10] = 0  // compression
  ihdr[11] = 0  // filter
  ihdr[12] = 0  // interlace

  // IDAT: filter byte (0 = None) + RGB row data
  const rawRows = Buffer.alloc(buf.h * (1 + buf.w * 3))
  for (let y = 0; y < buf.h; y++) {
    const rowOff = y * (1 + buf.w * 3)
    rawRows[rowOff] = 0  // filter: None
    for (let x = 0; x < buf.w; x++) {
      const srcIdx = (y * buf.w + x) * 3
      const dstIdx = rowOff + 1 + x * 3
      rawRows[dstIdx] = buf.data[srcIdx]
      rawRows[dstIdx + 1] = buf.data[srcIdx + 1]
      rawRows[dstIdx + 2] = buf.data[srcIdx + 2]
    }
  }
  const compressed = deflateSync(rawRows)

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ])

  const path = join(EXPORT_DIR, filename)
  writeFileSync(path, png)
  console.log(`  -> ${path}`)
}

// ── Screen definitions ──────────────────────────────────────────────────────

const screens = [
  {
    name: 'lobby-waiting.png',
    desc: 'Lobby - waiting for game to start',
    display: {
      line1: { left: 'P3 SLEEPER', right: 'LOBBY' },
      line2: { text: 'Waiting...', style: 'normal' },
      line3: { text: '' },
      icons: [{ id: 'sleeper' }, { id: 'empty' }, { id: 'empty' }],
    }
  },
  {
    name: 'night-target-select.png',
    desc: 'Night phase - selecting a target (locked)',
    display: {
      line1: { left: 'P1 ALPHA', right: 'NIGHT 2' },
      line2: { text: 'Dave', style: 'locked' },
      line3: { left: '[YES] Pick', center: '', right: 'Skip [NO]' },
      icons: [{ id: 'alpha' }, { id: 'empty' }, { id: 'empty' }],
    }
  },
  {
    name: 'day-vote.png',
    desc: 'Day phase - voting on a player',
    display: {
      line1: { left: 'P5 SEEKER', right: 'DAY 3' },
      line2: { text: 'Condemn?', style: 'normal' },
      line3: { left: '[YES] Vote', center: 'Mike', right: 'Pass [NO]' },
      icons: [{ id: 'seeker' }, { id: 'empty' }, { id: 'empty' }],
    }
  },
  {
    name: 'idle-three-icons.png',
    desc: 'Idle screen with 3 icons and selection bar on slot 1',
    display: {
      line1: { left: 'P2 HUNTER', right: 'DAY 1' },
      line2: { text: 'IDLE', style: 'normal' },
      line3: { left: '[YES] Use', center: 'Pistol', right: 'Next [NO]' },
      icons: [{ id: 'hunter' }, { id: 'pistol' }, { id: 'clue' }],
      idleScrollIndex: 1,
    }
  },
  {
    name: 'action-select-bar-top.png',
    desc: 'Action layer with 3 icons, selection bar on slot 0',
    display: {
      line1: { left: 'P4 MEDIC', right: 'NIGHT 1' },
      line2: { text: 'Protect', style: 'normal' },
      line3: { left: '[YES] Select', center: '', right: 'Next [NO]' },
      icons: [{ id: 'medic' }, { id: 'pistol' }, { id: 'hardened' }],
      idleScrollIndex: 0,
    }
  },
  {
    name: 'action-select-bar-bottom.png',
    desc: 'Action layer with 3 icons, selection bar on slot 2',
    display: {
      line1: { left: 'P7 HANDLER', right: 'NIGHT 3' },
      line2: { text: 'Investigate', style: 'normal' },
      line3: { left: '[YES] Select', center: '', right: 'Next [NO]' },
      icons: [{ id: 'handler' }, { id: 'clue' }, { id: 'gavel' }],
      idleScrollIndex: 2,
    }
  },
  {
    name: 'dead-screen.png',
    desc: 'Dead player screen',
    display: {
      line1: { left: 'P6 SLEEPER', right: 'NIGHT 2' },
      line2: { text: 'DEAD', style: 'normal' },
      line3: { text: '' },
      icons: [{ id: 'skull' }, { id: 'empty' }, { id: 'empty' }],
    },
    color: COLOR_DIM
  },
  {
    name: 'game-over.png',
    desc: 'Game over screen',
    display: {
      line1: { left: 'P3 ALPHA', right: 'GAME OVER' },
      line2: { text: 'YOU WIN', style: 'locked' },
      line3: { text: 'House wins!' },
      icons: [{ id: 'alpha' }, { id: 'empty' }, { id: 'empty' }],
    }
  },
  {
    name: 'night-result.png',
    desc: 'Night event result - confirmed',
    display: {
      line1: { left: 'P1 ALPHA', right: 'NIGHT 2' },
      line2: { text: 'CONFIRMED', style: 'normal' },
      line3: { text: '' },
      icons: [{ id: 'alpha' }, { id: 'empty' }, { id: 'empty' }],
    }
  },
  {
    name: 'role-reveal-items.png',
    desc: 'Role with multiple items equipped',
    display: {
      line1: { left: 'P8 VIGILANTE', right: 'DAY 2' },
      line2: { text: 'IDLE', style: 'normal' },
      line3: { left: '[YES] Use', center: 'Gavel', right: 'Next [NO]' },
      icons: [{ id: 'vigilante' }, { id: 'gavel' }, { id: 'pistol' }],
      idleScrollIndex: 1,
    }
  },
]

// ── Render all screens ──────────────────────────────────────────────────────

console.log('Exporting TinyScreen images (256x64)...\n')

for (const screen of screens) {
  const buf = createBuffer(W, H)
  clearBuffer(buf, COLOR_BG)
  renderDisplay(buf, screen.display, screen.color || COLOR_NORMAL)
  console.log(`${screen.name} — ${screen.desc}`)
  writePNG(screen.name, buf)
}

// ── Glyph sheet ─────────────────────────────────────────────────────────────

const iconIds = Object.keys(Icons).filter(id => id !== 'empty')
const cols = 7
const rows = Math.ceil(iconIds.length / cols)
const CELL_W = 60   // wide enough for longest label ("vigilante" = 54px)
const CELL_H = 40   // 18px icon + 8px gap + 10px label + 4px bottom pad
const PAD = 6
const SHEET_W = cols * CELL_W + PAD * 2
const SHEET_H = rows * CELL_H + PAD * 2

const glyphBuf = createBuffer(SHEET_W, SHEET_H)
clearBuffer(glyphBuf, COLOR_BG)

for (let i = 0; i < iconIds.length; i++) {
  const col = i % cols
  const row = Math.floor(i / cols)
  const cellX = PAD + col * CELL_W
  const cellY = PAD + row * CELL_H
  const iconX = cellX + Math.floor((CELL_W - ICON_SIZE) / 2)
  const iconY = cellY

  drawIcon(glyphBuf, iconIds[i], iconX, iconY, COLOR_NORMAL)

  // Label below icon, centered in cell
  const label = iconIds[i]
  const labelW = label.length * FONT_6x10.width
  const labelX = cellX + Math.floor((CELL_W - labelW) / 2)
  const labelY = iconY + ICON_SIZE + 2 + FONT_6x10.baseline
  drawText(glyphBuf, label, labelX, labelY, FONT_6x10, COLOR_DIM)
}

console.log(`\nall-glyphs.png — All ${iconIds.length} icon glyphs`)
writePNG('all-glyphs.png', glyphBuf)

console.log('\nDone! Files are in exports/')
