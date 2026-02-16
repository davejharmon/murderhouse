// Pixel glyph renderer — amber CRT icons with chromatic aberration, glow, pixel grid + flicker
import { useRef, useEffect } from 'react'
import { Icons } from '@shared/icons.js'
import styles from './PixelGlyph.module.css'

const ICON_SIZE = 18
const BYTES_PER_ROW = 3
const PIXEL_SIZE = 7   // filled portion of each cell
const GAP = 1           // border between pixels
const CELL = PIXEL_SIZE + GAP
const CANVAS_SIZE = ICON_SIZE * CELL // 144

const FLICKER_AMPLITUDE = 0.08
const AMBER = { r: 255, g: 176, b: 0 } // #ffb000

// Parse XBM bytes into an 18x18 boolean grid
function parseXbm(data) {
  const grid = []
  for (let row = 0; row < ICON_SIZE; row++) {
    const rowPixels = []
    const offset = row * BYTES_PER_ROW
    for (let col = 0; col < ICON_SIZE; col++) {
      const byteIdx = offset + Math.floor(col / 8)
      const bitIdx = col % 8
      rowPixels.push((data[byteIdx] >> bitIdx) & 1)
    }
    grid.push(rowPixels)
  }
  return grid
}

// Generate per-pixel random maps (base intensity, sin phase, sin speed)
function generatePixelMaps() {
  const base = []
  const phase = []
  const speed = []
  for (let row = 0; row < ICON_SIZE; row++) {
    const bRow = [], pRow = [], sRow = []
    for (let col = 0; col < ICON_SIZE; col++) {
      bRow.push(0.7 + Math.random() * 0.3)       // range 0.7–1.0
      pRow.push(Math.random() * Math.PI * 2)
      sRow.push(1.5 + Math.random() * 1.5)        // 1.5–3.0 radians/sec
    }
    base.push(bRow)
    phase.push(pRow)
    speed.push(sRow)
  }
  return { base, phase, speed }
}

// Draw a single color channel onto a canvas with pixel grid
function drawChannel(ctx, grid, maps, time, channelR, channelG, channelB) {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  const imageData = ctx.createImageData(CANVAS_SIZE, CANVAS_SIZE)
  const pixels = imageData.data

  for (let row = 0; row < ICON_SIZE; row++) {
    const gradientFactor = 1.0 - 0.3 * (row / (ICON_SIZE - 1))
    for (let col = 0; col < ICON_SIZE; col++) {
      if (!grid[row][col]) continue

      const flicker = Math.sin(time * maps.speed[row][col] + maps.phase[row][col]) * FLICKER_AMPLITUDE
      const intensity = Math.max(0.6, Math.min(1.0, maps.base[row][col] + flicker)) * gradientFactor

      const r = Math.round(channelR * intensity)
      const g = Math.round(channelG * intensity)
      const b = Math.round(channelB * intensity)

      const cellX = col * CELL
      const cellY = row * CELL
      for (let py = 0; py < PIXEL_SIZE; py++) {
        for (let px = 0; px < PIXEL_SIZE; px++) {
          const idx = ((cellY + py) * CANVAS_SIZE + (cellX + px)) * 4
          pixels[idx] = r
          pixels[idx + 1] = g
          pixels[idx + 2] = b
          pixels[idx + 3] = 255
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

export default function PixelGlyph({ iconId, size, children }) {
  const iconData = Icons[iconId]
  const mapsRef = useRef(null)
  const glowRef = useRef(null)
  const redRef = useRef(null)
  const greenRef = useRef(null)
  const blueRef = useRef(null)
  const rafRef = useRef(null)

  if (!mapsRef.current) {
    mapsRef.current = generatePixelMaps()
  }

  useEffect(() => {
    if (!iconData) return

    const grid = parseXbm(iconData)
    const { r, g, b } = AMBER
    const maps = mapsRef.current

    const glowCtx = glowRef.current?.getContext('2d')
    const redCtx = redRef.current?.getContext('2d')
    const greenCtx = greenRef.current?.getContext('2d')
    const blueCtx = blueRef.current?.getContext('2d')

    let startTime = null
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp
      const time = (timestamp - startTime) / 1000

      if (glowCtx) drawChannel(glowCtx, grid, maps, time, r, g, b)
      if (redCtx) drawChannel(redCtx, grid, maps, time, r, 0, 0)
      if (greenCtx) drawChannel(greenCtx, grid, maps, time, 0, g, 0)
      if (blueCtx) drawChannel(blueCtx, grid, maps, time, 0, 0, b)

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [iconData])

  if (!iconData) return children || null

  return (
    <div
      className={styles.container}
      style={{ width: size, height: size }}
    >
      <canvas ref={glowRef} className={styles.glow} width={CANVAS_SIZE} height={CANVAS_SIZE} />
      <canvas ref={redRef} className={styles.layerR} width={CANVAS_SIZE} height={CANVAS_SIZE} />
      <canvas ref={greenRef} className={styles.layerG} width={CANVAS_SIZE} height={CANVAS_SIZE} />
      <canvas ref={blueRef} className={styles.layerB} width={CANVAS_SIZE} height={CANVAS_SIZE} />
    </div>
  )
}
