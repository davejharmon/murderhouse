// client/src/components/slides/FallbackSlide.jsx
import { GamePhase, PlayerStatus } from '@shared/constants.js'
import { SLIDE_STRINGS } from './slideStrings.js'
import styles from '../../pages/Screen.module.css'

export default function FallbackSlide({ gameState, strings = SLIDE_STRINGS.fallback }) {
  const phase = gameState?.phase

  if (!phase || phase === GamePhase.LOBBY) {
    return (
      <div className={styles.slide}>
        <h1 className={styles.title}>{strings.title}</h1>
        <p className={styles.subtitle}>
          {strings.players.replace('{n}', gameState?.players?.length || 0)}
        </p>
      </div>
    )
  }

  return (
    <div className={styles.slide}>
      <h1 className={styles.title}>
        {phase === GamePhase.DAY
          ? `${strings.day} ${gameState.dayCount}`
          : `${strings.night} ${gameState.dayCount}`}
      </h1>
      <div className={styles.gallery}>
        {gameState?.players?.map((p) => {
          const isDead = p.status !== PlayerStatus.ALIVE
          return (
            <div
              key={p.id}
              className={`${styles.playerThumb} ${isDead ? styles.dead : ''} ${p.isCowering && !isDead ? styles.cowering : ''}`}
            >
              <img src={`/images/players/${p.portrait}`} alt={p.name} />
              {p.isCowering && !isDead && <div className={styles.cowardBadge}>{SLIDE_STRINGS.death.coward}</div>}
              {p.hasNovote && !isDead && <div className={styles.tooMadBadge}>{SLIDE_STRINGS.death.mad}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
