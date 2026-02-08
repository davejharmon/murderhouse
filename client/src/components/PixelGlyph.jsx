// client/src/components/PixelGlyph.jsx
// Renders 8x8 bitmap glyphs as CSS box-shadow pixel art (amber OLED style)

// Decode XBM byte rows into [{x,y}] pixel coordinates
// Byte bit layout: bit 7 = x:0 (leftmost), bit 0 = x:7
function decodeXBM(bytes) {
  const pixels = []
  for (let y = 0; y < bytes.length; y++) {
    for (let bit = 7; bit >= 0; bit--) {
      if (bytes[y] & (1 << bit)) {
        pixels.push({ x: 7 - bit, y })
      }
    }
  }
  return pixels
}

// Ghost (:skull:) - from ESP32 protocol.h BITMAP_GHOST
const GHOST_BYTES = [0x3C, 0x7E, 0xFF, 0xDB, 0xFF, 0xFF, 0xBD, 0xA5]

// Wolf (:wolf:) - from ESP32 protocol.h BITMAP_WOLF
const WOLF_BYTES = [0x81, 0xC3, 0xFF, 0xDB, 0xFF, 0x7E, 0x3C, 0x18]

// Pre-compute box-shadow strings at module level (not per-render)
function buildBoxShadow(bytes, px) {
  const pixels = decodeXBM(bytes)
  return pixels
    .map(({ x, y }) => `${x * px}px ${y * px}px 0 0 var(--oled-amber)`)
    .join(',')
}

// Cache shadows for each pixel size
const shadowCache = {}
function getShadow(name, bytes, px) {
  const key = `${name}_${px}`
  if (!shadowCache[key]) {
    shadowCache[key] = buildBoxShadow(bytes, px)
  }
  return shadowCache[key]
}

const GLYPHS = {
  skull: GHOST_BYTES,
  wolf: WOLF_BYTES,
}

/**
 * PixelGlyph - Renders an 8x8 bitmap glyph using CSS box-shadow
 * @param {string} name - 'skull' or 'wolf'
 * @param {number} px - Pixel size (e.g. 1.5 for small lines, 3 for line2)
 */
export default function PixelGlyph({ name, px = 2 }) {
  const bytes = GLYPHS[name]
  if (!bytes) return null

  const shadow = getShadow(name, bytes, px)
  const size = 8 * px

  return (
    <span
      style={{
        display: 'inline-block',
        width: `${size}px`,
        height: `${size}px`,
        position: 'relative',
        verticalAlign: 'middle',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${px}px`,
          height: `${px}px`,
          boxShadow: shadow,
        }}
      />
    </span>
  )
}
