// client/src/components/slides/VictorySlide.jsx
import { getSlideColor } from './slideUtils.js'
import styles from '../../pages/Screen.module.css'

export default function VictorySlide({ slide }) {
  return (
    <div key={slide.id} className={`${styles.slide} ${styles.victorySlide}`}>
      <h1
        className={styles.victoryTitle}
        style={{ color: getSlideColor(slide) }}
      >
        {slide.title}
      </h1>
      {slide.subtitle && <p className={styles.subtitle}>{slide.subtitle}</p>}
      {slide.winners && slide.winners.length > 0 && (
        <div className={styles.victoryGallery}>
          {slide.winners.map((w) => (
            <div
              key={w.id}
              className={`${styles.playerThumb} ${!w.isAlive ? styles.dead : ''}`}
            >
              <img src={`/images/players/${w.portrait}`} alt={w.name} />
              <span className={styles.thumbName}>{w.name}</span>
              <span
                className={styles.victoryRole}
                style={{ color: w.roleColor }}
              >
                {w.roleName}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
