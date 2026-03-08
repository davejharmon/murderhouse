// client/src/components/slides/PlayerRevealSlide.jsx
import { fitFontSize, getSlideColor } from './slideUtils.js'
import { SLIDE_STRINGS } from './slideStrings.js'
import styles from '../../pages/Screen.module.css'

export default function PlayerRevealSlide({ slide, players }) {
  const player = players?.find(p => p.id === slide.playerId)
  if (!player) return null

  const voters = (slide.voterIds || []).map(id => players?.find(p => p.id === id)).filter(Boolean)

  return (
    <div key={slide.id} className={styles.slide}>
      {slide.title && (
        <h1 className={styles.title} style={{ fontSize: fitFontSize(slide.title), color: getSlideColor(slide) }}>
          {slide.title}
        </h1>
      )}
      <div className={styles.playerReveal}>
        <div className={styles.portraitWrap}>
          <img
            src={`/images/players/${player.portrait}`}
            alt={player.name}
            className={styles.largePortrait}
          />
          {slide.jesterWon && <div className={styles.winnerBadgeLarge}>WINNER</div>}
          {!slide.jesterWon && player.isCowering && <div className={styles.cowardBadgeLarge}>{SLIDE_STRINGS.death.coward}</div>}
          {!slide.jesterWon && player.hasNovote && <div className={styles.tooMadBadgeLarge}>{SLIDE_STRINGS.death.mad}</div>}
        </div>
        {slide.subtitle ? (
          <h2 className={styles.deathName}>{slide.subtitle}</h2>
        ) : (
          <h1 className={styles.title} style={{ fontSize: fitFontSize(player.name) }}>{player.name}</h1>
        )}
        {slide.revealRole && (player.role || slide.revealText) && (
          <p
            className={styles.roleReveal}
            style={{ color: slide.revealText ? '#888' : player.roleColor }}
          >
            {slide.revealText || player.roleName}
          </p>
        )}
      </div>
      {voters.length > 0 && (
        <div className={styles.votersSection}>
          <div className={styles.votersGallery}>
            {voters.map((voter) => (
              <div key={voter.id} className={styles.voterThumb}>
                <img
                  src={`/images/players/${voter.portrait}`}
                  alt={voter.name}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
