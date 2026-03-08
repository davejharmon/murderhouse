// client/src/components/slides/ScoreUpdateSlide.jsx
// Shows score awards at end of game with animated "+N" badges
import { useEffect, useState } from 'react'
import { fitFontSize } from './slideUtils.js'
import styles from '../../pages/Screen.module.css'

export default function ScoreUpdateSlide({ slide }) {
  const [showBadges, setShowBadges] = useState(false)

  useEffect(() => {
    setShowBadges(false)
    const timer = setTimeout(() => setShowBadges(true), 1500)
    return () => clearTimeout(timer)
  }, [slide.id])

  const groups = slide.groups || []

  return (
    <div key={slide.id} className={styles.slide}>
      <h1 className={styles.scoreUpdateTitle} style={{ fontSize: fitFontSize(slide.title, 6) }}>
        {slide.title}
      </h1>
      {groups.map((group, gi) => (
        <div key={gi} className={styles.scoreUpdateGroup}>
          <h2 className={styles.scoreUpdateGroupLabel}>{group.label}</h2>
          <div className={styles.gallery}>
            {group.players.map((p) => (
              <div key={p.id} className={styles.playerThumb}>
                <div className={styles.portraitWrap}>
                  <img src={`/images/players/${p.portrait}`} alt={p.name} />
                  {showBadges && (
                    <div className={styles.scoreBadge}>+{group.points}</div>
                  )}
                </div>
                <span className={styles.thumbName}>{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
