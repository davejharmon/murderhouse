// client/src/pages/Screen.jsx
import { useEffect, useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGame } from '../context/GameContext'
import { SlideType } from '@shared/constants.js'
import {
  FallbackSlide,
  TitleSlide,
  PlayerRevealSlide,
  VoteTallySlide,
  GallerySlide,
  CountdownSlide,
  DeathSlide,
  VictorySlide,
  CompositionSlide,
  RoleTipSlide,
  ItemTipSlide,
  OperatorSlide,
  ScoresSlide,
  HeartbeatSlide,
} from '../components/slides/index.js'
import styles from './Screen.module.css'

export default function Screen() {
  const {
    connected,
    gameState,
    currentSlide,
    slideQueue,
    eventTimers,
    connectAsScreen,
  } = useGame()

  const effectiveSlide = currentSlide || slideQueue?.current

  useEffect(() => {
    console.log('[Screen] State update:', {
      connected,
      phase: gameState?.phase,
      playerCount: gameState?.players?.length,
      currentSlide: currentSlide ? { type: currentSlide.type, id: currentSlide.id } : null,
      slideQueueCurrent: slideQueue?.current ? { type: slideQueue.current.type, id: slideQueue.current.id } : null,
      effectiveSlide: effectiveSlide ? { type: effectiveSlide.type, id: effectiveSlide.id } : null,
      slideQueueLen: slideQueue?.queue?.length,
    })
  }, [connected, gameState, currentSlide, slideQueue, effectiveSlide])

  useEffect(() => {
    document.title = 'Screen - MURDERHOUSE'
  }, [])

  useEffect(() => {
    if (connected) connectAsScreen()
  }, [connected, connectAsScreen])

  const renderSlide = () => {
    const players = gameState?.players

    if (!effectiveSlide) {
      console.log('[Screen] renderSlide: no effectiveSlide, rendering fallback')
      return <FallbackSlide gameState={gameState} />
    }
    console.log('[Screen] renderSlide:', effectiveSlide.type)

    switch (effectiveSlide.type) {
      case SlideType.TITLE:
        return <TitleSlide slide={effectiveSlide} players={players} />

      case SlideType.PLAYER_REVEAL: {
        const player = players?.find(p => p.id === effectiveSlide.playerId)
        if (!player) return <FallbackSlide gameState={gameState} />
        return <PlayerRevealSlide slide={effectiveSlide} players={players} />
      }

      case SlideType.VOTE_TALLY:
        return <VoteTallySlide slide={effectiveSlide} players={players} />

      case SlideType.GALLERY:
        return <GallerySlide slide={effectiveSlide} players={players} gameState={gameState} eventTimers={eventTimers} />

      case SlideType.COUNTDOWN:
        return <CountdownSlide slide={effectiveSlide} />

      case SlideType.DEATH: {
        const player = players?.find(p => p.id === effectiveSlide.playerId)
        if (!player) return <FallbackSlide gameState={gameState} />
        return <DeathSlide slide={effectiveSlide} players={players} />
      }

      case SlideType.VICTORY:
        return <VictorySlide slide={effectiveSlide} />

      case SlideType.COMPOSITION:
        return <CompositionSlide slide={effectiveSlide} />

      case SlideType.ROLE_TIP:
        return <RoleTipSlide slide={effectiveSlide} />

      case SlideType.ITEM_TIP:
        return <ItemTipSlide slide={effectiveSlide} />

      case SlideType.HEARTBEAT:
        return <HeartbeatSlide slide={effectiveSlide} gameState={gameState} />

      case SlideType.OPERATOR:
        return <OperatorSlide slide={effectiveSlide} />

      case SlideType.SCORES:
        return <ScoresSlide slide={effectiveSlide} players={players} />

      default:
        return <TitleSlide slide={effectiveSlide} players={players} />
    }
  }

  // Auto-scale slide content to fit viewport
  const wrapperRef = useRef(null)
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current
    const slide = wrapper?.firstElementChild
    if (!slide) return
    slide.style.transform = ''
    const availableH = wrapper.clientHeight
    const naturalH = slide.offsetHeight
    if (naturalH > availableH) {
      slide.style.transform = `scale(${availableH / naturalH})`
    }
  }, [effectiveSlide, gameState])

  return (
    <div className={styles.container}>
      <div className={styles.navLinks}>
        <Link to='/host'>Host</Link>
        <Link to='/debug'>Debug</Link>
      </div>
      <div
        key={effectiveSlide?.id}
        ref={wrapperRef}
        className={`${styles.slideWrapper} ${effectiveSlide?.type === SlideType.ROLE_TIP && effectiveSlide?.team === 'cell' ? styles.cellBg : ''} ${effectiveSlide?.type === SlideType.HEARTBEAT ? styles.heartbeatBg : ''}`}
      >
        {renderSlide()}
      </div>
    </div>
  )
}
