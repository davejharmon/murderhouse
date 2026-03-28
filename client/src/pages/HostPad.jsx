// client/src/pages/HostPad.jsx
// iPad-optimized host dashboard — touch-first, single-screen layout
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useGame } from '../context/GameContext'
import {
  ClientMsg, GamePhase, PlayerStatus, SlideStyle, AUTO_ADVANCE_DELAY,
  AVAILABLE_ROLES, ROLE_DISPLAY, ITEM_DISPLAY, AVAILABLE_ITEMS,
} from '@shared/constants.js'
import GameLog from '../components/GameLog'
import SettingsModal from '../components/SettingsModal'
import TutorialSlidesModal from '../components/TutorialSlidesModal'
import HeartbeatModal from '../components/HeartbeatModal'
import CalibrationModal from '../components/CalibrationModal'
import ScoresModal from '../components/ScoresModal'
import CustomEventModal from '../components/CustomEventModal'
import ItemManagerModal from '../components/ItemManagerModal'
import PortraitSelectorModal from '../components/PortraitSelectorModal'
import { getStr } from '../strings/index.js'
import s from './HostPad.module.css'

function PadScreenPreview() {
  const ref = useRef(null)
  const [scale, setScale] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const widthScale = el.clientWidth / 1920
      const heightScale = el.clientHeight / 1080
      setScale(Math.min(widthScale, heightScale))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const scaledW = Math.round(1920 * scale)
  const scaledH = Math.round(1080 * scale)
  return (
    <div ref={ref} className={s.screenWrap}>
      <div style={{ width: scaledW, height: scaledH, overflow: 'hidden' }}>
        <iframe
          src='/screen'
          title='Screen preview'
          style={{ width: 1920, height: 1080, border: 'none', display: 'block', pointerEvents: 'none', transform: `scale(${scale})`, transformOrigin: 'top left' }}
        />
      </div>
    </div>
  )
}

export default function HostPad() {
  const {
    connected, gameState, slideQueue, eventTimers, log, notifications,
    send, addNotification, connectAsHost, gamePresets, presetSettings,
    setPresetSettings, hostSettings, operatorState, scores, calibrationState,
  } = useGame()

  // --- State ---
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(false)
  const [timerDuration, setTimerDuration] = useState(30)
  const [loadedPresetId, setLoadedPresetId] = useState(null)
  const hostSettingsApplied = useRef(false)
  const autoAdvanceTimerRef = useRef(null)
  const autoAdvancePausedRef = useRef(false)
  const prevQueueLengthRef = useRef(0)

  // UI state
  const [showSidebar, setShowSidebar] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [showScreen, setShowScreen] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showTutorialSlides, setShowTutorialSlides] = useState(false)
  const [showHeartbeat, setShowHeartbeat] = useState(false)
  const [showCalibration, setShowCalibration] = useState(false)
  const [showScores, setShowScores] = useState(false)
  const [showCustomEvent, setShowCustomEvent] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState(null) // tap-to-action
  const [showItemManager, setShowItemManager] = useState(null) // playerId
  const [showPortrait, setShowPortrait] = useState(null) // playerId

  // Unplayed slides warning
  const hasUnplayedSlides = slideQueue?.queue?.length > 0 && slideQueue.currentIndex < slideQueue.queue.length - 1
  const [slideWarningArmed, setSlideWarningArmed] = useState(false)
  useEffect(() => { if (!hasUnplayedSlides) setSlideWarningArmed(false) }, [hasUnplayedSlides])

  const guardedAction = (action) => {
    if (hasUnplayedSlides && !slideWarningArmed) {
      setSlideWarningArmed(true)
      addNotification('Warning! Unplayed slides', 'error')
      return
    }
    setSlideWarningArmed(false)
    action()
  }

  // --- Effects ---
  useEffect(() => { document.title = 'HostPad - MURDERHOUSE' }, [])
  useEffect(() => { if (connected) connectAsHost() }, [connected, connectAsHost])

  useEffect(() => {
    if (!hostSettings || hostSettingsApplied.current) return
    hostSettingsApplied.current = true
    setTimerDuration(hostSettings.timerDuration ?? 30)
    setAutoAdvanceEnabled(hostSettings.autoAdvanceEnabled ?? false)
    if (hostSettings.lastLoadedPresetId) setLoadedPresetId(hostSettings.lastLoadedPresetId)
  }, [hostSettings])

  useEffect(() => {
    if (!presetSettings) return
    if (presetSettings.timerDuration != null) setTimerDuration(presetSettings.timerDuration)
    if (presetSettings.autoAdvanceEnabled != null) setAutoAdvanceEnabled(presetSettings.autoAdvanceEnabled)
    setPresetSettings(null)
  }, [presetSettings, setPresetSettings])

  // Auto-advance
  useEffect(() => {
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current)
    autoAdvanceTimerRef.current = null
    if (!autoAdvanceEnabled || !slideQueue) return
    const { currentIndex = -1, queue = [] } = slideQueue
    if (queue.length > prevQueueLengthRef.current) autoAdvancePausedRef.current = false
    prevQueueLengthRef.current = queue.length
    const canAdvance = currentIndex < queue.length - 1
    const currentSlide = queue[currentIndex]
    if (canAdvance && !autoAdvancePausedRef.current) {
      let delay = AUTO_ADVANCE_DELAY
      if (currentSlide?.type === 'operator') {
        const words = currentSlide.words ?? []
        delay = Math.max(delay, 1600 + Math.max(0, words.length - 1) * 1100 + 1180)
      }
      autoAdvanceTimerRef.current = setTimeout(() => send(ClientMsg.NEXT_SLIDE), delay)
    }
    return () => { if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current) }
  }, [autoAdvanceEnabled, slideQueue, send])

  // --- Derived ---
  const phase = gameState?.phase || GamePhase.LOBBY
  const isLobby = phase === GamePhase.LOBBY
  const isGameOver = phase === GamePhase.GAME_OVER
  const players = gameState?.players || []
  const timerActive = Object.keys(eventTimers || {}).length > 0
  const timerPaused = Object.values(eventTimers || {}).some(t => t.paused)
  const pendingEvents = gameState?.pendingEvents || []
  const activeEvents = gameState?.activeEvents || []
  const eventProgress = gameState?.eventProgress || {}
  const slideCount = slideQueue?.queue?.length || 0
  const slideIdx = (slideQueue?.currentIndex ?? -1) + 1

  const loadedPreset = useMemo(() => gamePresets.find(p => p.id === loadedPresetId) ?? null, [gamePresets, loadedPresetId])

  // --- Handlers ---
  const handleStartGame = () => send(ClientMsg.START_GAME)
  const handleResetGame = () => { if (window.confirm('Reset game?')) send(ClientMsg.RESET_GAME) }
  const handleNextPhase = () => guardedAction(() => send(ClientMsg.NEXT_PHASE))
  const handleStartEvent = (eventId) => guardedAction(() => send(ClientMsg.START_EVENT, { eventId }))
  const handleStartAllEvents = () => guardedAction(() => send(ClientMsg.START_ALL_EVENTS))
  const handleResolveEvent = (eventId) => guardedAction(() => send(ClientMsg.RESOLVE_EVENT, { eventId }))
  const handleResolveAllEvents = () => guardedAction(() => send(ClientMsg.RESOLVE_ALL_EVENTS))
  const handleSkipEvent = (eventId) => send(ClientMsg.SKIP_EVENT, { eventId })
  const handleResetEvent = (eventId) => send(ClientMsg.RESET_EVENT, { eventId })
  const handleStartEventTimer = () => send(ClientMsg.START_EVENT_TIMER, { duration: timerDuration * 1000 })
  const handleNextSlide = () => send(ClientMsg.NEXT_SLIDE)
  const handlePrevSlide = () => { autoAdvancePausedRef.current = true; send(ClientMsg.PREV_SLIDE) }
  const handleClearSlides = () => send(ClientMsg.CLEAR_SLIDES)
  const handleKillPlayer = (id) => send(ClientMsg.KILL_PLAYER, { playerId: id })
  const handleRevivePlayer = (id) => send(ClientMsg.REVIVE_PLAYER, { playerId: id })
  const handleKickPlayer = (id) => { if (window.confirm('Remove player?')) send(ClientMsg.KICK_PLAYER, { playerId: id }) }
  const handleGiveItem = (playerId, itemId) => send(ClientMsg.GIVE_ITEM, { playerId, itemId })
  const handleRemoveItem = (playerId, itemId) => send(ClientMsg.REMOVE_ITEM, { playerId, itemId })
  const handleChangeRole = (playerId, roleId) => send(ClientMsg.CHANGE_ROLE, { playerId, roleId })
  const handlePreAssignRole = (playerId, roleId) => send(ClientMsg.PRE_ASSIGN_ROLE, { playerId, roleId })
  const handleRandomizeRoles = () => send(ClientMsg.RANDOMIZE_ROLES)
  const handleSetName = (playerId, name) => send(ClientMsg.SET_NAME, { playerId, name })
  const handleSetPortrait = (playerId, portrait) => send(ClientMsg.SET_PLAYER_PORTRAIT, { playerId, portrait })
  const handleCreateCustomEvent = (config) => { send(ClientMsg.CREATE_CUSTOM_EVENT, config); setShowCustomEvent(false) }
  const handlePushCompSlide = () => send(ClientMsg.PUSH_COMP_SLIDE)
  const handlePushRoleTipSlide = (roleId) => send(ClientMsg.PUSH_ROLE_TIP_SLIDE, { roleId })
  const handlePushItemTipSlide = (itemId) => send(ClientMsg.PUSH_ITEM_TIP_SLIDE, { itemId })
  const handlePushHeartbeatSlide = (playerId) => send(ClientMsg.PUSH_HEARTBEAT_SLIDE, { playerId })
  const handlePushScoreSlide = () => send(ClientMsg.PUSH_SCORE_SLIDE)
  const handleSetScore = (name, score) => send(ClientMsg.SET_SCORE, { name, score })
  const handleScoringConfigChange = (scoringConfig) => send(ClientMsg.SAVE_HOST_SETTINGS, { scoringConfig })
  const handleTimerDurationChange = (seconds) => { setTimerDuration(seconds); send(ClientMsg.SAVE_HOST_SETTINGS, { timerDuration: seconds, autoAdvanceEnabled }) }
  const handleToggleAutoAdvance = (val) => { setAutoAdvanceEnabled(val); send(ClientMsg.SAVE_HOST_SETTINGS, { timerDuration, autoAdvanceEnabled: val }) }
  const handleSaveGamePreset = (name, overwriteId) => send(ClientMsg.SAVE_GAME_PRESET, { name, timerDuration, autoAdvanceEnabled, fakeHeartbeats: gameState?.fakeHeartbeats ?? false, overwriteId })
  const handleLoadGamePreset = (id) => { setLoadedPresetId(id); send(ClientMsg.LOAD_GAME_PRESET, { id }) }
  const handleDeleteGamePreset = (id) => { if (id === loadedPresetId) setLoadedPresetId(null); send(ClientMsg.DELETE_GAME_PRESET, { id }) }
  const handleSetDefaultPreset = (id) => send(ClientMsg.SET_DEFAULT_PRESET, { id })
  const handleDebugAutoSelectAll = (eventId) => send(ClientMsg.DEBUG_AUTO_SELECT_ALL, { eventId })
  const handlePushPhaseSlide = () => {
    const title = phase === GamePhase.DAY ? `DAY ${gameState?.dayCount}` : `NIGHT ${gameState?.dayCount}`
    const playerIds = players.filter(p => p.status === PlayerStatus.ALIVE).map(p => p.id)
    send(ClientMsg.PUSH_SLIDE, { slide: { type: 'gallery', title, playerIds, style: SlideStyle.NEUTRAL }, jumpTo: true })
  }

  // --- Player tile helpers ---
  const isAlive = (p) => p.status === PlayerStatus.ALIVE
  const roleColor = (p) => p.roleColor || '#888'

  // --- Render ---
  return (
    <div className={s.root}>
      {/* Notifications */}
      <div className='notifications'>
        {notifications.map(n => <div key={n.id} className={`notification ${n.type}`}>{n.message}</div>)}
      </div>

      {/* === TOP BAR === */}
      <div className={s.topBar}>
        <button className={s.topBtn} onClick={() => setShowSidebar(v => !v)}>☰</button>
        {!isLobby && !isGameOver ? (
          <button className={s.phaseBtn} onClick={handlePushPhaseSlide}>
            {phase === GamePhase.DAY ? `DAY ${gameState?.dayCount}` : `NIGHT ${gameState?.dayCount}`}
          </button>
        ) : (
          <div className={s.phase}>{isLobby ? 'LOBBY' : 'GAME OVER'}</div>
        )}
        {!isLobby && !isGameOver && (
          <button className={`${s.topBtn} ${slideWarningArmed ? s.warn : ''}`} onClick={handleNextPhase} title="Next Phase">⏭</button>
        )}
        <div className={s.slideNav}>
          <button className={s.topBtn} onClick={handlePrevSlide} disabled={slideIdx <= 1}>◀</button>
          <span className={`${s.slideCount} ${slideWarningArmed ? s.warn : ''}`}>
            {slideCount > 0 ? `${slideIdx}/${slideCount}` : '—'}
          </span>
          <button className={s.topBtn} onClick={handleNextSlide} disabled={slideIdx >= slideCount}>▶</button>
        </div>
        <button className={s.topBtn} onClick={() => setShowScreen(v => !v)}>{showScreen ? '🖥' : '🖥'}</button>
        <button className={s.topBtn} onClick={() => setShowLog(true)}>📋</button>
        <button className={s.topBtn} onClick={() => setShowSettings(true)}>⚙</button>
      </div>

      {/* === SCREEN PREVIEW === */}
      {showScreen && <PadScreenPreview />}

      {/* === PLAYER TILES === */}
      <div className={s.players}>
        {players.map(p => {
          const alive = isAlive(p)
          const selected = selectedPlayer === p.id
          return (
            <div
              key={p.id}
              className={`${s.tile} ${!alive ? s.dead : ''} ${selected ? s.selected : ''}`}
              onClick={() => setSelectedPlayer(selected ? null : p.id)}
            >
              <div className={s.tilePortrait}>
                <img src={`/images/players/${p.portrait}`} alt={p.name} />
                {!p.connected && <div className={s.disconnected}>●</div>}
              </div>
              <div className={s.tileName}>#{p.seatNumber} {p.name}</div>
              <div className={s.tileRole} style={{ color: roleColor(p) }}>
                {p.roleName || (isLobby ? '' : '?')}
              </div>
              <div className={s.tileItems}>
                {(p.inventory || []).map((item, i) => (
                  <span key={i} title={ITEM_DISPLAY[item.id]?.name}>{ITEM_DISPLAY[item.id]?.emoji || '?'}</span>
                ))}
                {(p.hiddenInventory || []).map((item, i) => (
                  <span key={`h${i}`} style={{ opacity: 0.6 }} title={ITEM_DISPLAY[item.id]?.name}>{ITEM_DISPLAY[item.id]?.emoji || '?'}</span>
                ))}
              </div>
              {/* Action popup */}
              {selected && (
                <div className={s.actions} onClick={e => e.stopPropagation()}>
                  {isLobby && <button className={s.actBtn} onClick={() => handleKickPlayer(p.id)}>✕ Kick</button>}
                  {!isLobby && alive && <button className={s.actBtn} onClick={() => handleKillPlayer(p.id)}>💀 Kill</button>}
                  {!isLobby && !alive && <button className={s.actBtn} onClick={() => handleRevivePlayer(p.id)}>↺ Revive</button>}
                  <button className={s.actBtn} onClick={() => { setShowItemManager(p.id); setSelectedPlayer(null) }}>📦 Items</button>
                  <button className={s.actBtn} onClick={() => { setShowPortrait(p.id); setSelectedPlayer(null) }}>📷</button>
                  <button className={s.actBtn} onClick={() => {
                    const name = window.prompt('Player name:', p.name)
                    if (name && name.trim()) handleSetName(p.id, name.trim())
                  }}>✏️ Name</button>
                  {!isLobby && (
                    <select
                      className={s.roleSelect}
                      value={p.role || ''}
                      onChange={e => handleChangeRole(p.id, e.target.value)}
                    >
                      {AVAILABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_DISPLAY[r]?.name || r}</option>)}
                    </select>
                  )}
                  {isLobby && (
                    <select
                      className={s.roleSelect}
                      value={p.preAssignedRole || ''}
                      onChange={e => handlePreAssignRole(p.id, e.target.value || null)}
                    >
                      <option value="">Random</option>
                      {AVAILABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_DISPLAY[r]?.name || r}</option>)}
                    </select>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* === EVENT BAR === */}
      {!isLobby && !isGameOver && (
        <div className={s.eventBar}>
          {pendingEvents.length > 0 && (
            <div className={s.eventGroup}>
              {pendingEvents.map(eid => (
                <button key={eid} className={`${s.evBtn} ${slideWarningArmed ? s.warn : ''}`} onClick={() => handleStartEvent(eid)}>
                  ▶ {eid === 'customEvent' ? (gameState?.customEventConfig?.rewardParam?.toUpperCase() + ' VOTE' || 'Custom') : eid}
                </button>
              ))}
              {pendingEvents.length > 1 && <button className={`${s.evBtn} ${s.primary} ${slideWarningArmed ? s.warn : ''}`} onClick={handleStartAllEvents}>▶ All</button>}
            </div>
          )}
          {activeEvents.length > 0 && (
            <div className={s.eventGroup}>
              {activeEvents.map(eid => {
                const prog = eventProgress[eid] || {}
                return (
                  <button key={eid} className={`${s.evBtn} ${slideWarningArmed ? s.warn : ''}`} onClick={() => handleResolveEvent(eid)}>
                    ✔ {eid} {prog.responded || 0}/{prog.total || 0}
                  </button>
                )
              })}
              {activeEvents.length > 1 && <button className={`${s.evBtn} ${s.success} ${slideWarningArmed ? s.warn : ''}`} onClick={handleResolveAllEvents}>✔ All</button>}
              {!timerActive && <button className={s.evBtn} onClick={handleStartEventTimer}>⏱ {timerDuration}s</button>}
              {timerActive && <button className={s.evBtn} onClick={timerPaused ? () => send(ClientMsg.RESUME_EVENT_TIMER) : () => send(ClientMsg.PAUSE_EVENT_TIMER)}>{timerPaused ? '▶' : '⏸'}</button>}
              {timerActive && <button className={`${s.evBtn} ${s.danger}`} onClick={() => send(ClientMsg.CANCEL_EVENT_TIMER)}>✕</button>}
              <button className={s.evBtn} onClick={() => activeEvents.forEach(eid => handleDebugAutoSelectAll(eid))}>🎲</button>
            </div>
          )}
          {phase === GamePhase.DAY && (
            <button className={s.evBtn} onClick={() => setShowCustomEvent(true)}>+ Event</button>
          )}
        </div>
      )}

      {/* === GAME CONTROL BAR (lobby/gameover) === */}
      {isLobby && (
        <div className={s.eventBar}>
          <button className={`${s.evBtn} ${s.primary}`} onClick={handleStartGame} disabled={players.length < 4}>Start Game</button>
          {players.some(p => p.preAssignedRole) && <button className={s.evBtn} onClick={handleRandomizeRoles}>🔀 Shuffle</button>}
          <button className={`${s.evBtn} ${s.danger}`} onClick={handleResetGame}>Reset</button>
        </div>
      )}
      {isGameOver && (
        <div className={s.eventBar}>
          <button className={`${s.evBtn} ${s.danger}`} onClick={handleResetGame}>Reset</button>
        </div>
      )}

      {/* === OPERATOR BAR === */}
      <div className={s.opBar}>
        <div className={s.opMsg}>
          {operatorState?.words?.length > 0
            ? operatorState.words.join(' ')
            : <span className={s.opEmpty}>No operator message</span>}
          {operatorState?.ready && <span className={s.opReady}> ● READY</span>}
        </div>
        <button className={s.opSend} disabled={!operatorState?.words?.length} onClick={() => send(ClientMsg.OPERATOR_SEND)}>👻</button>
      </div>

      {/* === SIDEBAR DRAWER === */}
      {showSidebar && <div className={s.overlay} onClick={() => setShowSidebar(false)} />}
      <div className={`${s.sidebar} ${showSidebar ? s.open : ''}`}>
        <div className={s.sideSection}>
          <div className={s.sidePhase}>
            {loadedPreset && <span className={s.presetName}>{loadedPreset.name}</span>}
          </div>
          {!isLobby && !isGameOver && (
            <>
              <button className={s.sideBtn} onClick={() => { handlePushPhaseSlide(); setShowSidebar(false) }}>
                {phase === GamePhase.DAY ? `DAY ${gameState?.dayCount}` : `NIGHT ${gameState?.dayCount}`}
              </button>
              <button className={`${s.sideBtn} ${slideWarningArmed ? s.warn : ''}`} onClick={() => { handleNextPhase(); setShowSidebar(false) }}>Next Phase</button>
            </>
          )}
          <button className={`${s.sideBtn} ${s.danger}`} onClick={() => { handleResetGame(); setShowSidebar(false) }}>Reset Game</button>
        </div>
        <div className={s.sideSection}>
          <button className={s.sideBtn} onClick={() => { setShowTutorialSlides(true); setShowSidebar(false) }}>Tutorials</button>
          <button className={s.sideBtn} onClick={() => { handlePushScoreSlide(); setShowSidebar(false) }}>Scoreboard</button>
          <button className={s.sideBtn} onClick={() => { setShowCalibration(true); setShowSidebar(false) }}>Calibration</button>
          <button className={`${s.sideBtn} ${gameState?.heartbeatMode ? s.primary : ''}`} onClick={() => send(ClientMsg.TOGGLE_HEARTBEAT_MODE)}>Heartbeat Mode</button>
        </div>
        <div className={s.sideSection}>
          <label className={s.checkRow}>
            <input type="checkbox" checked={autoAdvanceEnabled} onChange={e => handleToggleAutoAdvance(e.target.checked)} />
            Auto-advance
          </label>
          <div className={s.timerRow}>
            <span>Timer:</span>
            <input type="number" min="1" max="300" value={timerDuration} onChange={e => handleTimerDurationChange(parseInt(e.target.value) || 1)} className={s.timerInput} />
            <span>s</span>
          </div>
          <button className={s.sideBtn} onClick={() => handleClearSlides()}>Clear Slides</button>
        </div>
      </div>

      {/* === FULLSCREEN LOG === */}
      {showLog && (
        <div className={s.logOverlay} onClick={() => setShowLog(false)}>
          <div className={s.logContent} onClick={e => e.stopPropagation()}>
            <button className={s.logClose} onClick={() => setShowLog(false)}>✕</button>
            <GameLog entries={log} />
          </div>
        </div>
      )}

      {/* === MODALS === */}
      <SettingsModal
        isOpen={showSettings} onClose={() => setShowSettings(false)}
        presets={gamePresets} onSavePreset={handleSaveGamePreset}
        onLoadPreset={handleLoadGamePreset} onDeletePreset={handleDeleteGamePreset}
        defaultPresetId={hostSettings?.defaultPresetId ?? null}
        onSetDefault={handleSetDefaultPreset}
        timerDuration={timerDuration} onTimerDurationChange={handleTimerDurationChange}
        onOpenCalibration={() => { setShowSettings(false); setShowCalibration(true) }}
        onOpenScores={() => { setShowSettings(false); setShowScores(true) }}
        hostSettings={hostSettings}
        onSaveSettings={(settings) => send(ClientMsg.SAVE_HOST_SETTINGS, settings)}
      />
      <TutorialSlidesModal isOpen={showTutorialSlides} onClose={() => setShowTutorialSlides(false)}
        players={players} onPushCompSlide={handlePushCompSlide}
        onPushRoleTipSlide={handlePushRoleTipSlide} onPushItemTipSlide={handlePushItemTipSlide} />
      <HeartbeatModal isOpen={showHeartbeat} onClose={() => setShowHeartbeat(false)}
        players={players} onPushHeartbeatSlide={handlePushHeartbeatSlide} />
      <CalibrationModal isOpen={showCalibration} onClose={() => setShowCalibration(false)}
        players={players} calibrationState={calibrationState} hostSettings={hostSettings} send={send} />
      <ScoresModal isOpen={showScores} onClose={() => setShowScores(false)}
        players={players} scores={scores} onSetScore={handleSetScore}
        scoringConfig={hostSettings?.scoringConfig} onScoringConfigChange={handleScoringConfigChange} />
      <CustomEventModal isOpen={showCustomEvent} onClose={() => setShowCustomEvent(false)}
        onSubmit={handleCreateCustomEvent}
        availableItems={AVAILABLE_ITEMS.map(id => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) }))}
        availableRoles={AVAILABLE_ROLES.filter(r => !['alpha','jester'].includes(r)).map(r => ({ id: r, name: ROLE_DISPLAY[r]?.name || r }))} />
      {showItemManager && (
        <ItemManagerModal
          isOpen={true} onClose={() => setShowItemManager(null)}
          player={players.find(p => p.id === showItemManager)}
          onGiveItem={(playerId, itemId) => handleGiveItem(playerId, itemId)}
          onRemoveItem={(playerId, itemId) => handleRemoveItem(playerId, itemId)}
        />
      )}
      {showPortrait && (
        <PortraitSelectorModal
          isOpen={true} onClose={() => setShowPortrait(null)}
          onSelect={(portrait) => { handleSetPortrait(showPortrait, portrait); setShowPortrait(null) }}
        />
      )}
    </div>
  )
}
