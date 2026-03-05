// client/src/components/slides/DeathSlide.jsx
import { SlideStyle } from '@shared/constants.js'
import { fitFontSize, getSlideColor } from './slideUtils.js'
import { SLIDE_STRINGS } from './slideStrings.js'
import styles from '../../pages/Screen.module.css'

export default function DeathSlide({ slide, players, strings = SLIDE_STRINGS.death }) {
  const player = players?.find(p => p.id === slide.playerId)
  if (!player) return null

  if (slide.coward) {
    return (
      <div key={slide.id} className={`${styles.slide} ${styles.deathSlide}`}>
        <h1
          className={styles.title}
          style={{ fontSize: fitFontSize(slide.title), color: getSlideColor(slide, SlideStyle.WARNING) }}
        >
          {slide.title}
        </h1>
        <div className={styles.deathReveal}>
          <div className={styles.cowardPortraitWrap}>
            <img
              src={`/images/players/${player.portrait}`}
              alt={player.name}
              className={`${styles.largePortrait} ${styles.cowardPortrait}`}
            />
            <div className={styles.cowardBadgeLarge}>{strings.coward}</div>
            {player.hasNovote && <div className={styles.tooMadBadgeLarge}>{strings.mad}</div>}
          </div>
          <h2 className={styles.deathName}>{slide.subtitle}</h2>
          {slide.revealText && (
            <p className={styles.roleReveal} style={{ color: '#888' }}>
              {slide.revealText}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div key={slide.id} className={`${styles.slide} ${styles.deathSlide}`}>
      <h1
        className={styles.title}
        style={{ fontSize: fitFontSize(slide.title || strings.eliminated), color: getSlideColor(slide, SlideStyle.HOSTILE) }}
      >
        {slide.title || strings.eliminated}
      </h1>
      <div className={styles.deathReveal}>
        <div className={styles.portraitWrap}>
          <img
            src={`/images/players/${player.portrait}`}
            alt={player.name}
            className={`${styles.largePortrait} ${styles.deathPortrait}`}
          />
          {player.hasNovote && <div className={styles.tooMadBadgeLarge}>{strings.mad}</div>}
        </div>
        {slide.revealRole && (player.role || slide.revealText) && (
          <p
            className={styles.roleReveal}
            style={{ color: slide.revealText ? '#888' : player.roleColor }}
          >
            {slide.revealText || player.roleName}
          </p>
        )}
        {slide.revealRole && slide.remainingComposition?.length > 0 && (() => {
          const sortKey = (e) => {
            if (e.team === 'village')  return e.dim ? 0 : 1
            if (e.team === 'neutral')  return e.dim ? 2 : 3
            if (e.team === 'unknown')  return 4
            if (e.team === 'werewolf') return e.dim ? 6 : 5
            return 4
          }
          const sorted = [...slide.remainingComposition].sort((a, b) => sortKey(a) - sortKey(b))
          return (
            <div className={styles.compGallery}>
              {sorted.map((entry, i) => (
                <div
                  key={i}
                  className={`${styles.compPortrait} ${styles[`compTeam_${entry.team}`]}`}
                  style={entry.dim ? { opacity: 0.12 } : undefined}
                >
                  <img src="/images/players/anon.png" alt="" />
                  {entry.team === 'unknown' && <div className={styles.compUnknownMark}>?</div>}
                </div>
              ))}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
