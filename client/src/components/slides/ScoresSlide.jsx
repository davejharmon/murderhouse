// client/src/components/slides/ScoresSlide.jsx
import { useEffect, useRef, useState } from 'react'
import { SLIDE_STRINGS } from './slideStrings.js'
import styles from '../../pages/Screen.module.css'

// Animated number counter
function AnimatedScore({ from, to, animate }) {
  const [value, setValue] = useState(from)
  const ref = useRef(null)

  useEffect(() => {
    if (!animate) { setValue(from); return }
    if (from === to) { setValue(to); return }
    const duration = 800
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1)
      // ease-out quad
      const eased = 1 - (1 - t) * (1 - t)
      setValue(Math.round(from + (to - from) * eased))
      if (t < 1) ref.current = requestAnimationFrame(tick)
    }
    ref.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(ref.current)
  }, [from, to, animate])

  return <>{value}</>
}

// Animation phases:  INIT (show old) -> COUNT (animate numbers) -> SHUFFLE (reorder)
const PHASE_INIT = 0
const PHASE_COUNT = 1
const PHASE_SHUFFLE = 2

export default function ScoresSlide({ slide, strings = SLIDE_STRINGS.scores }) {
  const entries = slide.entries || []
  const previousEntries = slide.previousEntries || null
  const hasAnimation = previousEntries && previousEntries.length > 0

  const [phase, setPhase] = useState(hasAnimation ? PHASE_INIT : PHASE_SHUFFLE)

  useEffect(() => {
    if (!hasAnimation) { setPhase(PHASE_SHUFFLE); return }
    setPhase(PHASE_INIT)
    const t1 = setTimeout(() => setPhase(PHASE_COUNT), 600)
    const t2 = setTimeout(() => setPhase(PHASE_SHUFFLE), 1800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [slide.id, hasAnimation])

  if (!hasAnimation) {
    // Static scoreboard (no previous data)
    return (
      <div key={slide.id} className={`${styles.slide} ${styles.scoreSlide}`}>
        <h1 className={styles.scoreTitle}>{slide.title || strings.title}</h1>
        <div className={styles.scoreTable}>
          {entries.map((entry, i) => (
            <div key={entry.name} className={styles.scoreEntry}>
              <span className={styles.scoreRank}>#{i + 1}</span>
              {entry.portrait && (
                <img src={`/images/players/${entry.portrait}`} alt={entry.name} className={styles.scorePortrait} />
              )}
              <span className={styles.scoreEntryName}>{entry.name}</span>
              <span className={styles.scoreEntryValue}>{entry.score}</span>
            </div>
          ))}
          {entries.length === 0 && <div className={styles.scoreEmpty}>{strings.empty}</div>}
        </div>
      </div>
    )
  }

  // Build a map of old scores and old order
  const oldScoreMap = {}
  const oldOrder = {}
  previousEntries.forEach((e, i) => { oldScoreMap[e.name] = e.score; oldOrder[e.name] = i })

  // Build new order map
  const newOrder = {}
  entries.forEach((e, i) => { newOrder[e.name] = i })

  // Render in OLD order, apply translateY to shuffle into NEW order
  // Use previousEntries as the render list so keys stay stable
  const renderList = previousEntries.filter(e => newOrder[e.name] !== undefined)

  // Measure row height (fixed layout, all rows same height)
  const rowRef = useRef(null)
  const [rowHeight, setRowHeight] = useState(0)

  useEffect(() => {
    if (rowRef.current) {
      const el = rowRef.current
      // row height = element height + gap
      const style = window.getComputedStyle(el.parentElement)
      const gap = parseFloat(style.gap) || 0
      setRowHeight(el.offsetHeight + gap)
    }
  }, [renderList.length])

  return (
    <div key={slide.id} className={`${styles.slide} ${styles.scoreSlide}`}>
      <h1 className={styles.scoreTitle}>{slide.title || strings.title}</h1>
      <div className={styles.scoreTable}>
        {renderList.map((entry, i) => {
          const oldIdx = i
          const newIdx = newOrder[entry.name] ?? i
          const offset = phase === PHASE_SHUFFLE ? (newIdx - oldIdx) * rowHeight : 0
          const displayRank = phase === PHASE_SHUFFLE ? newIdx + 1 : oldIdx + 1
          const oldScore = oldScoreMap[entry.name] ?? 0
          const newScore = entries.find(e => e.name === entry.name)?.score ?? oldScore

          return (
            <div
              key={entry.name}
              ref={i === 0 ? rowRef : undefined}
              className={styles.scoreEntry}
              style={{
                transform: `translateY(${offset}px)`,
                transition: phase === PHASE_SHUFFLE ? 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
              }}
            >
              <span className={styles.scoreRank}>#{displayRank}</span>
              {entry.portrait && (
                <img src={`/images/players/${entry.portrait}`} alt={entry.name} className={styles.scorePortrait} />
              )}
              <span className={styles.scoreEntryName}>{entry.name}</span>
              <span className={styles.scoreEntryValue}>
                <AnimatedScore from={oldScore} to={newScore} animate={phase >= PHASE_COUNT} />
              </span>
            </div>
          )
        })}
        {renderList.length === 0 && <div className={styles.scoreEmpty}>{strings.empty}</div>}
      </div>
    </div>
  )
}
