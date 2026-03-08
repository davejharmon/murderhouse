// client/src/components/slides/BestSuspectSlide.jsx
// Shows the player with the most correct suspect picks + their suspect history
import { useEffect, useState } from 'react'
import { fitFontSize } from './slideUtils.js'
import styles from '../../pages/Screen.module.css'

export default function BestSuspectSlide({ slide }) {
  const [showBadge, setShowBadge] = useState(false)

  useEffect(() => {
    setShowBadge(false)
    const timer = setTimeout(() => setShowBadge(true), 1500)
    return () => clearTimeout(timer)
  }, [slide.id])

  const winner = slide.winner // { id, name, portrait }
  const suspects = slide.suspects || [] // [{ name, portrait, wasCorrect }]
  const points = slide.points || 0

  return (
    <div key={slide.id} className={styles.slide}>
      <h1 className={styles.scoreUpdateTitle} style={{ fontSize: fitFontSize(slide.title, 6) }}>
        {slide.title}
      </h1>
      {winner && (
        <div className={styles.bestSuspectHero}>
          <div className={styles.portraitWrap}>
            <img
              src={`/images/players/${winner.portrait}`}
              alt={winner.name}
              className={styles.largePortrait}
            />
            {showBadge && (
              <div className={styles.scoreBadgeLarge}>+{points}</div>
            )}
          </div>
          <h2 className={styles.bestSuspectName}>{winner.name}</h2>
        </div>
      )}
      {suspects.length > 0 && (
        <div className={styles.gallery}>
          {suspects.map((s, i) => (
            <div
              key={i}
              className={`${styles.playerThumb} ${s.wasCorrect ? styles.suspectCorrect : styles.suspectWrong}`}
            >
              <img src={`/images/players/${s.portrait}`} alt={s.name} />
              <span className={styles.thumbName}>{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
