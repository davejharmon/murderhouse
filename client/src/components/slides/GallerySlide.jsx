// client/src/components/slides/GallerySlide.jsx
// Handles both regular gallery and timer gallery (when slide.timerEventId is set).
import { useEffect, useMemo, useRef, useState } from 'react'
import { GamePhase, PlayerStatus } from '@shared/constants.js'
import { fitFontSize, getSlideColor, bpmColor } from './slideUtils.js'
import { SLIDE_STRINGS } from './slideStrings.js'
import styles from '../../pages/Screen.module.css'

// Animated BPM counter — ticks one integer at a time toward the target value
function AnimatedBpm({ value, threshold }) {
  const [displayed, setDisplayed] = useState(value)
  const displayedRef = useRef(value)
  const targetRef = useRef(value)

  targetRef.current = value

  useEffect(() => {
    const tick = setInterval(() => {
      const target = targetRef.current
      const current = displayedRef.current
      if (current === target) return
      const next = current + Math.sign(target - current)
      displayedRef.current = next
      setDisplayed(next)
    }, 30)
    return () => clearInterval(tick)
  }, [])

  return (
    <span
      className={`${styles.thumbBpm} ${displayed >= threshold ? styles.thumbBpmDanger : ''}`}
      style={{ color: bpmColor(displayed, threshold) }}
    >{displayed}</span>
  )
}

const TIMER_RADIUS = 50
const TIMER_CIRCUMFERENCE = 2 * Math.PI * TIMER_RADIUS

export default function GallerySlide({ slide, players, gameState, eventTimers, strings = SLIDE_STRINGS.gallery }) {
  const getPlayer = (id) => players?.find(p => p.id === id)

  const allPlayers = gameState?.players || []
  const deadCellMembers = useMemo(
    () =>
      allPlayers
        .filter(p => p.status !== PlayerStatus.ALIVE && p.roleTeam === 'cell')
        .sort((a, b) => (a.deathTimestamp || 0) - (b.deathTimestamp || 0)),
    [allPlayers],
  )

  const heartbeatMode = gameState?.heartbeatMode
  const heartbeatThreshold = gameState?.heartbeatThreshold ?? 110

  // ── Timer gallery ────────────────────────────────────────────────────────────
  const [timerDisplay, setTimerDisplay] = useState(null)

  useEffect(() => {
    if (!slide.timerEventId) {
      setTimerDisplay(null)
      return
    }

    // Production: use eventTimers from game state
    if (eventTimers) {
      const entries = Object.entries(eventTimers)
      if (entries.length === 0) { setTimerDisplay(null); return }
      const earliest = entries.reduce((min, [, t]) => (t.endsAt < min.endsAt ? t : min), entries[0][1])
      // When paused, show frozen remaining time
      if (earliest.paused) {
        const remaining = earliest.remaining || 0
        setTimerDisplay(remaining > 0 ? { seconds: Math.ceil(remaining / 1000), fraction: remaining / earliest.duration, paused: true } : null)
        return
      }
      const tick = () => {
        const remaining = Math.max(0, earliest.endsAt - Date.now())
        setTimerDisplay(remaining > 0 ? { seconds: Math.ceil(remaining / 1000), fraction: remaining / earliest.duration } : null)
      }
      tick()
      const id = setInterval(tick, 50)
      return () => clearInterval(id)
    }

    // Editor fallback: mock 30-second timer
    const duration = 30000
    const endsAt = Date.now() + duration
    const tick = () => {
      const remaining = Math.max(0, endsAt - Date.now())
      setTimerDisplay(remaining > 0 ? { seconds: Math.ceil(remaining / 1000), fraction: remaining / duration } : null)
    }
    tick()
    const id = setInterval(tick, 50)
    return () => clearInterval(id)
  }, [slide.id, slide.timerEventId, eventTimers])

  if (slide.timerEventId) {
    const timerPlayers = (slide.playerIds || []).map(getPlayer).filter(Boolean)
    const dashOffset = timerDisplay
      ? TIMER_CIRCUMFERENCE * (1 - timerDisplay.fraction)
      : TIMER_CIRCUMFERENCE
    const respondentIds = gameState?.eventRespondents?.[slide.timerEventId]
    const confirmedSet = respondentIds ? new Set(respondentIds) : null

    return (
      <div key={slide.id} className={styles.slide}>
        {slide.title && (
          <h1 className={styles.title} style={{ fontSize: fitFontSize(slide.title), color: getSlideColor(slide) }}>
            {slide.title}
          </h1>
        )}
        {timerDisplay && (
          <div className={styles.timerWidget}>
            <svg viewBox='0 0 120 120' className={styles.timerSvg}>
              <circle cx='60' cy='60' r={TIMER_RADIUS} className={styles.timerTrack} />
              <circle
                cx='60' cy='60' r={TIMER_RADIUS}
                className={styles.timerFill}
                strokeDasharray={TIMER_CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <span className={styles.timerSeconds}>{timerDisplay.seconds}</span>
          </div>
        )}
        {slide.subtitle && <p className={styles.subtitle}>{slide.subtitle}</p>}
        <div className={styles.gallery}>
          {timerPlayers.map((p) => (
            <div
              key={p.id}
              className={`${styles.playerThumb} ${confirmedSet?.has(p.id) ? styles.confirmed : ''} ${p.isCowering ? styles.cowering : ''}`}
            >
              <img src={`/images/players/${p.portrait}`} alt={p.name} />
              {p.isCowering && <div className={styles.cowardBadge}>{strings.coward}</div>}
              {p.hasNovote && <div className={styles.tooMadBadge}>{strings.mad}</div>}
              <span className={styles.thumbName}>{p.name}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Targets-only gallery ──────────────────────────────────────────────────────
  const galleryPlayers = (slide.playerIds || []).map(getPlayer).filter(Boolean)

  if (slide.targetsOnly) {
    const respondentIds = gameState?.eventRespondents?.[slide.activeEventId]
    const confirmedSet = respondentIds ? new Set(respondentIds) : null

    return (
      <div key={slide.id} className={styles.slide}>
        {slide.title && <h1 className={styles.title} style={{ fontSize: fitFontSize(slide.title) }}>{slide.title}</h1>}
        {slide.subtitle && <p className={styles.subtitle}>{slide.subtitle}</p>}
        <div className={styles.gallery}>
          {galleryPlayers.map((p) => (
            <div
              key={p.id}
              className={`${styles.playerThumb} ${confirmedSet?.has(p.id) ? styles.confirmed : ''} ${p.isCowering ? styles.cowering : ''}`}
            >
              <img src={`/images/players/${p.portrait}`} alt={p.name} />
              {p.isCowering && <div className={styles.cowardBadge}>{strings.coward}</div>}
              {p.hasNovote && <div className={styles.tooMadBadge}>{strings.mad}</div>}
              {heartbeatMode && p.heartbeat?.active && (
                <AnimatedBpm value={p.heartbeat.bpm} threshold={heartbeatThreshold} />
              )}
              <span className={styles.thumbName}>{p.name}</span>
            </div>
          ))}
        </div>
        {slide.itemDescription && (
          <p className={styles.itemFlavorText}>{slide.itemDescription}</p>
        )}
      </div>
    )
  }

  // ── Standard gallery ──────────────────────────────────────────────────────────
  const playersWithoutDeadCell = galleryPlayers.filter(
    (p) => p.status === PlayerStatus.ALIVE || p.roleTeam !== 'cell',
  )
  const totalCellMembers = gameState?.totalCellMembers || 0

  return (
    <div key={slide.id} className={styles.slide}>
      {slide.title && <h1 className={styles.title} style={{ fontSize: fitFontSize(slide.title) }}>{slide.title}</h1>}
      <div className={styles.gallery}>
        {playersWithoutDeadCell.map((p) => {
          const isDead = p.status !== PlayerStatus.ALIVE
          return (
            <div
              key={p.id}
              className={`${styles.playerThumb} ${isDead ? styles.dead : ''} ${p.isCowering && !isDead ? styles.cowering : ''}`}
            >
              <img src={`/images/players/${p.portrait}`} alt={p.name} />
              {p.isCowering && !isDead && <div className={styles.cowardBadge}>{strings.coward}</div>}
              {p.hasNovote && !isDead && <div className={styles.tooMadBadge}>{strings.mad}</div>}
              {heartbeatMode && !isDead && p.heartbeat?.active && (
                <AnimatedBpm value={p.heartbeat.bpm} threshold={heartbeatThreshold} />
              )}
              <span className={styles.thumbName}>{p.name}</span>
            </div>
          )
        })}
      </div>
      {slide.subtitle && <p className={styles.subtitle}>{slide.subtitle}</p>}
      {totalCellMembers > 0 && gameState?.phase !== GamePhase.LOBBY && (
        <div className={styles.cellTracker}>
          <div className={styles.gallery}>
            {Array.from({ length: totalCellMembers }).map((_, index) => {
              const deadCell = deadCellMembers[index]
              if (deadCell) {
                return (
                  <div key={`cell-${index}`} className={`${styles.playerThumb} ${styles.deadCell}`}>
                    <img src={`/images/players/${deadCell.portrait}`} alt={deadCell.name} />
                    <span className={styles.thumbName}>{deadCell.name}</span>
                  </div>
                )
              } else {
                return (
                  <div key={`cell-${index}`} className={`${styles.playerThumb} ${styles.anonCell}`}>
                    <img src='/images/players/anon.png' alt='Unknown Sleeper' />
                    <span className={styles.thumbName}>{strings.cell}</span>
                  </div>
                )
              }
            })}
          </div>
        </div>
      )}
    </div>
  )
}
