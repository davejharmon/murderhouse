// client/src/components/slides/ScoresSlide.jsx
import { SLIDE_STRINGS } from './slideStrings.js'
import styles from '../../pages/Screen.module.css'

export default function ScoresSlide({ slide, strings = SLIDE_STRINGS.scores }) {
  const entries = slide.entries || []
  return (
    <div key={slide.id} className={`${styles.slide} ${styles.scoreSlide}`}>
      <h1 className={styles.scoreTitle}>{slide.title || strings.title}</h1>
      <div className={styles.scoreTable}>
        {entries.map((entry, i) => (
          <div key={entry.name} className={styles.scoreEntry}>
            <span className={styles.scoreRank}>#{i + 1}</span>
            {entry.portrait && (
              <img
                src={`/images/players/${entry.portrait}`}
                alt={entry.name}
                className={styles.scorePortrait}
              />
            )}
            <span className={styles.scoreEntryName}>{entry.name}</span>
            <span className={styles.scoreEntryValue}>{entry.score}</span>
          </div>
        ))}
        {entries.length === 0 && (
          <div className={styles.scoreEmpty}>{strings.empty}</div>
        )}
      </div>
    </div>
  )
}
