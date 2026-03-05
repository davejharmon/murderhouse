// client/src/components/slides/slideUtils.js
import { SlideStyle, SlideStyleColors } from '@shared/constants.js'

// BPM colour thresholds and ramp parameters
const BPM_COLOR = {
  DANGER:         '#ff3333',            // solid red at or above threshold
  NEUTRAL:        'rgba(255,255,255,0.75)', // white below the ramp
  RAMP_START:     0.7,   // ramp begins at 70% of threshold
  HUE_YELLOW:     55,    // starting hue (yellow, degrees)
  HUE_RED:        0,     // ending hue (red)
  SAT_START:      80,    // base saturation (%)
  SAT_RANGE:      20,    // saturation increase across ramp
  LIT_START:      65,    // base lightness (%)
  LIT_RANGE:      15,    // lightness decrease across ramp
}

// BPM colour: neutral white below 70% of threshold, ramps yellow→orange→red up to threshold,
// solid danger red above it.
export function bpmColor(bpm, threshold) {
  if (bpm >= threshold) return BPM_COLOR.DANGER
  const start = threshold * BPM_COLOR.RAMP_START
  if (bpm <= start) return BPM_COLOR.NEUTRAL
  const t = (bpm - start) / (threshold - start) // 0 → 1
  const hue = Math.round(BPM_COLOR.HUE_YELLOW * (1 - t)) // yellow → red
  const sat = Math.round(BPM_COLOR.SAT_START + t * BPM_COLOR.SAT_RANGE)
  const lit = Math.round(BPM_COLOR.LIT_START - t * BPM_COLOR.LIT_RANGE)
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
