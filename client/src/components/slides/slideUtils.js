// client/src/components/slides/slideUtils.js
import { SlideStyle, SlideStyleColors } from '@shared/constants.js'

// BPM colour: neutral white below 80% of threshold, ramps yellow→orange→red up to threshold,
// solid danger red above it.
export function bpmColor(bpm, threshold) {
  if (bpm >= threshold) return '#ff3333'
  const start = threshold * 0.7
  if (bpm <= start) return 'rgba(255,255,255,0.75)'
  const t = (bpm - start) / (threshold - start) // 0 → 1
  const hue = Math.round(55 * (1 - t))           // 55° yellow → 0° red
  const sat = Math.round(80 + t * 20)
  const lit = Math.round(65 - t * 15)
  return `hsl(${hue}, ${sat}%, ${lit}%)`
}

// Compute font-size so a title string never wraps. .slide has 5vw side padding
// → 90vw available. Monospace + letter-spacing:0.1em ≈ 0.65× font-size per char.
export function fitFontSize(text, maxVw = 8) {
  if (!text) return `${maxVw}vw`
  const sized = 90 / (String(text).length * 0.65)
  return `${Math.min(maxVw, sized).toFixed(2)}vw`
}

// Get title color from slide style
export function getSlideColor(slide, defaultStyle = SlideStyle.NEUTRAL) {
  const slideStyle = slide.style || defaultStyle
  return SlideStyleColors[slideStyle]
}
