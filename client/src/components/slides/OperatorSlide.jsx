// client/src/components/slides/OperatorSlide.jsx
import { useEffect, useState } from 'react'
import styles from '../../pages/Screen.module.css'

const GLITCH_CHARS = '#@$!?%/\\|=~░▒▓╬╪'

function OperatorReveal({ words, slideId }) {
  const WORD_INTERVAL   = 1100
  const GLITCH_DURATION = 480
  const FLICKER_MS      = 65
  const START_DELAY     = 1600

  const [phases, setPhases]             = useState(() => words.map(() => 'hidden'))
  const [glitchTexts, setGlitchTexts]   = useState(() => words.map(() => ''))
  const [glitchStyles, setGlitchStyles] = useState(() => words.map(() => ({})))

  useEffect(() => {
    setPhases(words.map(() => 'hidden'))
    setGlitchTexts(words.map(() => ''))
    setGlitchStyles(words.map(() => ({})))

    const clearFns = []

    words.forEach((word, i) => {
      const jitter = Math.floor(Math.random() * 180)
      const glitchAt = START_DELAY + i * WORD_INTERVAL + jitter - GLITCH_DURATION
      const revealAt = START_DELAY + i * WORD_INTERVAL + jitter

      const glitchTimer = setTimeout(() => {
        setPhases(prev => { const n = [...prev]; n[i] = 'glitch'; return n })

        const iid = setInterval(() => {
          const len = Math.max(1, word.length + Math.floor(Math.random() * 5) - 2)
          let g = ''
          for (let j = 0; j < len; j++) {
            g += GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
          }
          const dx = Math.floor(Math.random() * 5 - 2)
          const rgbShadow = Math.random() > 0.35
            ? `${dx}px 0 rgba(255,30,80,0.85), ${-dx}px 0 rgba(0,255,190,0.85)`
            : `0 0 10px rgba(120,255,150,0.9)`
          const ty = (Math.random() * 6 - 3).toFixed(1)

          setGlitchTexts(prev  => { const n = [...prev]; n[i] = g; return n })
          setGlitchStyles(prev => {
            const n = [...prev]
            n[i] = { textShadow: rgbShadow, transform: `translateY(${ty}px)` }
            return n
          })
        }, FLICKER_MS)
        clearFns.push(() => clearInterval(iid))
      }, glitchAt)
      clearFns.push(() => clearTimeout(glitchTimer))

      const revealTimer = setTimeout(() => {
        setPhases(prev => { const n = [...prev]; n[i] = 'revealed'; return n })
      }, revealAt)
      clearFns.push(() => clearTimeout(revealTimer))
    })

    return () => clearFns.forEach(fn => fn())
  }, [slideId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.operatorMessage}>
      {words.map((word, i) => {
        const phase = phases[i]
        return (
          <span
            key={i}
            className={`${styles.operatorWord} ${phase === 'glitch' ? styles.operatorWordGlitch : ''} ${phase === 'revealed' ? styles.operatorWordRevealed : ''}`}
            style={phase === 'glitch' ? glitchStyles[i] : undefined}
          >
            {phase === 'glitch' ? glitchTexts[i] : word}
          </span>
        )
      })}
    </div>
  )
}

export default function OperatorSlide({ slide }) {
  const words = slide.words || []
  return (
    <div key={slide.id} className={`${styles.slide} ${styles.operatorSlide}`}>
      <p className={styles.operatorEyebrow}>{slide.title}</p>
      <OperatorReveal words={words} slideId={slide.id} />
    </div>
  )
}
