// client/src/components/slides/TitleSlide.jsx
import { fitFontSize } from './slideUtils.js'
import { SLIDE_STRINGS } from './slideStrings.js'
import styles from '../../pages/Screen.module.css'

export default function TitleSlide({ slide, players }) {
  const player = slide.playerId ? players?.find(p => p.id === slide.playerId) : null

  return (
    <div className={styles.slide}>
      {player && (
        <div className={styles.portraitWrap}>
          <img
            src={`/images/players/${player.portrait}`}
            alt={player.name}
            className={styles.largePortrait}
          />
          {player.isCowering && <div className={styles.cowardBadgeLarge}>{SLIDE_STRINGS.gallery.coward}</div>}
          {player.hasNovote && <div className={styles.tooMadBadgeLarge}>{SLIDE_STRINGS.death.mad}</div>}
        </div>
      )}
      <h1 className={styles.title} style={{ fontSize: fitFontSize(slide.title) }}>{slide.title}</h1>
      {slide.subtitle && <p className={styles.subtitle}>{slide.subtitle}</p>}
    </div>
  )
}
