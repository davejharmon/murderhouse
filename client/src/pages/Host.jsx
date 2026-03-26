// client/src/pages/Host.jsx
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import {
  ClientMsg,
  GamePhase,
  PlayerStatus,
  SlideStyle,
  AUTO_ADVANCE_DELAY,
} from '@shared/constants.js';
import PlayerGrid from '../components/PlayerGrid';
import ScreenPreview from '../components/ScreenPreview';
import EventPanel from '../components/EventPanel';
import SlideControls from '../components/SlideControls';
import GameLog from '../components/GameLog';
import SettingsModal from '../components/SettingsModal';
import TutorialSlidesModal from '../components/TutorialSlidesModal';
import HeartbeatModal from '../components/HeartbeatModal';
import CalibrationModal from '../components/CalibrationModal';
import ScoresModal from '../components/ScoresModal';
import { getStr } from '../strings/index.js';
import styles from './Host.module.css';

const TAB_CONTROLS = 0;
const TAB_PLAYERS = 1;
const TAB_LOG = 2;
const TAB_LABELS = () => [getStr('host', 'tabControls'), getStr('host', 'tabPlayers'), getStr('host', 'tabLog')];
const SWIPE_THRESHOLD = 50;

export default function Host() {
  const {
    connected,
    gameState,
    slideQueue,
    log,
    notifications,
    send,
    connectAsHost,
    gamePresets,
    presetSettings,
    setPresetSettings,
    hostSettings,
    operatorState,
    scores,
    calibrationState,
  } = useGame();

  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(false);
  const [timerDuration, setTimerDuration] = useState(30);
  const [heartbeatThreshold, setHeartbeatThreshold] = useState(110);
  const [loadedPresetId, setLoadedPresetId] = useState(null);
  const hostSettingsApplied = useRef(false);
  const autoAdvanceTimerRef = useRef(null);
  const autoAdvancePausedRef = useRef(false);
  const prevQueueLengthRef = useRef(0);

  const [showSettings, setShowSettings] = useState(false);
  const [showTutorialSlides, setShowTutorialSlides] = useState(false);
  const [showHeartbeat, setShowHeartbeat] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [showScreenPreview, setShowScreenPreview] = useState(
    () => localStorage.getItem('host.showScreenPreview') === 'true',
  );
  const [showOperator, setShowOperator] = useState(true);
  const toggleScreenPreview = (v) => {
    setShowScreenPreview((prev) => {
      const next = typeof v === 'boolean' ? v : !prev;
      localStorage.setItem('host.showScreenPreview', next);
      return next;
    });
  };

  // Mobile tab navigation
  const [mobileTab, setMobileTab] = useState(TAB_PLAYERS);
  const touchRef = useRef({ startX: 0, startY: 0, swiping: false });

  // Set page title
  useEffect(() => {
    document.title = 'Host - MURDERHOUSE';
  }, []);

  // Connect as host on mount
  useEffect(() => {
    if (connected) {
      connectAsHost();
    }
  }, [connected, connectAsHost]);

  // Apply host settings from server on first connect
  useEffect(() => {
    if (!hostSettings || hostSettingsApplied.current) return;
    hostSettingsApplied.current = true;
    setTimerDuration(hostSettings.timerDuration ?? 30);
    setAutoAdvanceEnabled(hostSettings.autoAdvanceEnabled ?? false);
    setHeartbeatThreshold(hostSettings.heartbeatThreshold ?? 110);
    if (hostSettings.lastLoadedPresetId)
      setLoadedPresetId(hostSettings.lastLoadedPresetId);
  }, [hostSettings]);

  // Derive the loaded preset object and dirty state
  const loadedPreset = useMemo(
    () => gamePresets.find((p) => p.id === loadedPresetId) ?? null,
    [gamePresets, loadedPresetId],
  );

  const isDirty = useMemo(() => {
    if (!loadedPreset) return false;
    if (timerDuration !== loadedPreset.timerDuration) return true;
    if (autoAdvanceEnabled !== loadedPreset.autoAdvanceEnabled) return true;
    if ((gameState?.fakeHeartbeats ?? false) !== (loadedPreset.fakeHeartbeats ?? false)) return true;
    const players = gameState?.players ?? [];
    for (const [seatId, saved] of Object.entries(loadedPreset.players ?? {})) {
      const current = players.find((p) => p.id === seatId);
      if (!current) continue;
      if (current.name !== saved.name) return true;
      if ((current.portrait ?? null) !== (saved.portrait ?? null)) return true;
    }
    if (loadedPreset.roleMode === 'assigned' && loadedPreset.roleAssignments) {
      // Compare every connected player's preAssignedRole against the saved assignment (or null if absent)
      for (const player of players) {
        const saved = loadedPreset.roleAssignments[player.id] ?? null;
        if ((player.preAssignedRole ?? null) !== saved) return true;
      }
    } else {
      // Random-pool preset: any pre-assignment is a deviation
      if (players.some((p) => p.preAssignedRole)) return true;
    }
    return false;
  }, [loadedPreset, timerDuration, autoAdvanceEnabled, gameState?.fakeHeartbeats, gameState?.players]);

  // Auto-advance logic
  useEffect(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    if (!autoAdvanceEnabled || !slideQueue) return;

    const { currentIndex = -1, queue = [] } = slideQueue;

    // Unpause when a new slide is pushed (queue grew)
    if (queue.length > prevQueueLengthRef.current) {
      autoAdvancePausedRef.current = false;
    }
    prevQueueLengthRef.current = queue.length;

    const canAdvance = currentIndex < queue.length - 1;
    const currentSlide = queue[currentIndex];

    if (canAdvance && !autoAdvancePausedRef.current && !currentSlide?.skipProtected) {
      // For operator slides, wait until the word-reveal animation finishes
      let delay = AUTO_ADVANCE_DELAY;
      if (currentSlide?.type === 'operator') {
        const words = currentSlide.words ?? [];
        const animDone = 1600 + Math.max(0, words.length - 1) * 1100 + 180;
        delay = Math.max(delay, animDone + 1000);
      }
      autoAdvanceTimerRef.current = setTimeout(() => {
        send(ClientMsg.NEXT_SLIDE);
      }, delay);
    }

    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, [autoAdvanceEnabled, slideQueue, send]);

  // Touch handlers for swipe
  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      swiping: false,
    };
  }, []);

  const handleTouchMove = useCallback((e) => {
    const ref = touchRef.current;
    const dx = e.touches[0].clientX - ref.startX;
    const dy = e.touches[0].clientY - ref.startY;
    // Only count as swipe if horizontal movement dominates
    if (!ref.swiping && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      ref.swiping = true;
    }
  }, []);

  const handleTouchEnd = useCallback((e) => {
    const ref = touchRef.current;
    if (!ref.swiping) return;
    const dx = e.changedTouches[0].clientX - ref.startX;
    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      setMobileTab((prev) => {
        if (dx < 0) return Math.min(prev + 1, 2); // swipe left → next
        return Math.max(prev - 1, 0); // swipe right → prev
      });
    }
  }, []);

  const phase = gameState?.phase || GamePhase.LOBBY;
  const isLobby = phase === GamePhase.LOBBY;
  const isGameOver = phase === GamePhase.GAME_OVER;

  const handleStartGame = () => send(ClientMsg.START_GAME);
  const handleNextPhase = () => send(ClientMsg.NEXT_PHASE);
  const handleResetGame = () => {
    if (window.confirm(getStr('host', 'resetConfirm'))) {
      send(ClientMsg.RESET_GAME);
    }
  };

  const handleStartEvent = (eventId) =>
    send(ClientMsg.START_EVENT, { eventId });
  const handleStartAllEvents = () => send(ClientMsg.START_ALL_EVENTS);
  const handleCreateCustomEvent = (config) =>
    send(ClientMsg.CREATE_CUSTOM_EVENT, config);
  const handleResolveEvent = (eventId) =>
    send(ClientMsg.RESOLVE_EVENT, { eventId });
  const handleResolveAllEvents = () => send(ClientMsg.RESOLVE_ALL_EVENTS);
  const handleSkipEvent = (eventId) => send(ClientMsg.SKIP_EVENT, { eventId });
  const handleResetEvent = (eventId) =>
    send(ClientMsg.RESET_EVENT, { eventId });
  const handleStartEventTimer = () =>
    send(ClientMsg.START_EVENT_TIMER, { duration: timerDuration * 1000 });
  const handleTimerDurationChange = (seconds) => {
    setTimerDuration(seconds);
    send(ClientMsg.SAVE_HOST_SETTINGS, {
      timerDuration: seconds,
      autoAdvanceEnabled,
    });
  };

  const handleToggleAutoAdvance = (val) => {
    setAutoAdvanceEnabled(val);
    send(ClientMsg.SAVE_HOST_SETTINGS, {
      timerDuration,
      autoAdvanceEnabled: val,
    });
  };

  const handleHeartbeatThresholdChange = (val) => {
    setHeartbeatThreshold(val);
    send(ClientMsg.SAVE_HOST_SETTINGS, { heartbeatThreshold: val });
  };

  const handleNextSlide = () => send(ClientMsg.NEXT_SLIDE);
  const handlePrevSlide = () => {
    autoAdvancePausedRef.current = true;
    send(ClientMsg.PREV_SLIDE);
  };
  const handleClearSlides = () => send(ClientMsg.CLEAR_SLIDES);

  const handleKillPlayer = (playerId) =>
    send(ClientMsg.KILL_PLAYER, { playerId });
  const handleRevivePlayer = (playerId) =>
    send(ClientMsg.REVIVE_PLAYER, { playerId });
  const handleKickPlayer = (playerId) => {
    if (window.confirm(getStr('host', 'removePlayerConfirm'))) {
      send(ClientMsg.KICK_PLAYER, { playerId });
    }
  };
  const handleSetName = (playerId, name) =>
    send(ClientMsg.SET_NAME, { playerId, name });
  const handleSetPortrait = (playerId, portrait) =>
    send(ClientMsg.SET_PLAYER_PORTRAIT, { playerId, portrait });
  const handleGiveItem = (playerId, itemId) =>
    send(ClientMsg.GIVE_ITEM, { playerId, itemId });
  const handleRemoveItem = (playerId, itemId) =>
    send(ClientMsg.REMOVE_ITEM, { playerId, itemId });
  // Apply settings when a game preset is loaded (server already persisted them)
  useEffect(() => {
    if (!presetSettings) return;
    if (presetSettings.timerDuration != null)
      setTimerDuration(presetSettings.timerDuration);
    if (presetSettings.autoAdvanceEnabled != null)
      setAutoAdvanceEnabled(presetSettings.autoAdvanceEnabled);
    setPresetSettings(null);
  }, [presetSettings, setPresetSettings]);

  const handleSaveGamePreset = (name, overwriteId) =>
    send(ClientMsg.SAVE_GAME_PRESET, {
      name,
      timerDuration,
      autoAdvanceEnabled,
      fakeHeartbeats: gameState?.fakeHeartbeats ?? false,
      overwriteId,
    });
  const handleLoadGamePreset = (id) => {
    setLoadedPresetId(id);
    send(ClientMsg.LOAD_GAME_PRESET, { id });
  };
  const handleDeleteGamePreset = (id) => {
    if (id === loadedPresetId) setLoadedPresetId(null);
    send(ClientMsg.DELETE_GAME_PRESET, { id });
  };
  const handleQuickSavePreset = () => {
    if (!loadedPreset) return;
    handleSaveGamePreset(loadedPreset.name, loadedPreset.id);
  };
  const handleSetDefaultPreset = (id) =>
    send(ClientMsg.SET_DEFAULT_PRESET, { id });

  const handleChangeRole = (playerId, roleId) =>
    send(ClientMsg.CHANGE_ROLE, { playerId, roleId });
  const handlePreAssignRole = (playerId, roleId) =>
    send(ClientMsg.PRE_ASSIGN_ROLE, { playerId, roleId });
  const handleRandomizeRoles = () => send(ClientMsg.RANDOMIZE_ROLES);
  const handlePushCompSlide = () => send(ClientMsg.PUSH_COMP_SLIDE);
  const handlePushRoleTipSlide = (roleId) =>
    send(ClientMsg.PUSH_ROLE_TIP_SLIDE, { roleId });
  const handlePushItemTipSlide = (itemId) =>
    send(ClientMsg.PUSH_ITEM_TIP_SLIDE, { itemId });

  const handlePushPhaseSlide = () => {
    const title =
      phase === GamePhase.DAY
        ? `DAY ${gameState?.dayCount}`
        : `NIGHT ${gameState?.dayCount}`;
    const playerIds = (gameState?.players ?? [])
      .filter((p) => p.status === PlayerStatus.ALIVE)
      .map((p) => p.id);
    send(ClientMsg.PUSH_SLIDE, {
      slide: { type: 'gallery', title, playerIds, style: SlideStyle.NEUTRAL },
      jumpTo: true,
    });
  };

  const handlePushHeartbeatSlide = (playerId) =>
    send(ClientMsg.PUSH_HEARTBEAT_SLIDE, { playerId });

  const handleSetScore = (name, score) =>
    send(ClientMsg.SET_SCORE, { name, score });

  const handleScoringConfigChange = (scoringConfig) =>
    send(ClientMsg.SAVE_HOST_SETTINGS, { scoringConfig });

  const handlePushScoreSlide = () => send(ClientMsg.PUSH_SCORE_SLIDE);

  const handleDebugAutoSelect = (playerId) =>
    send(ClientMsg.DEBUG_AUTO_SELECT, { playerId });
  const handleDebugAutoSelectAll = (eventId) =>
    send(ClientMsg.DEBUG_AUTO_SELECT_ALL, { eventId });

  // Shared panel contents (used in both desktop grid and mobile swipe)
  const controlsPanel = (
    <>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1>HOST</h1>
          {loadedPreset && (
            <div className={styles.presetStatus}>
              <span className={styles.presetStatusName}>
                {loadedPreset.name}
              </span>
              {isDirty && (
                <button
                  className={styles.presetSaveBtn}
                  onClick={handleQuickSavePreset}
                  title='Save changes'
                >
                  💾
                </button>
              )}
            </div>
          )}
        </div>
        <div className={styles.navLinks}>
          {import.meta.env.DEV && (
            <Link to='/strings' className={styles.navIcon} title='String Sheets'>🧵</Link>
          )}
          <Link to='/screen' className={styles.navIcon} title='Screen'>🖥️</Link>
          <Link to='/debug' className={styles.navIcon} title='Debug'>🐛</Link>
          <Link to='/operator' className={styles.navIcon} title='Operator'>👻</Link>
          <button
            className={styles.navIcon}
            onClick={() => setShowSettings(true)}
            title='Settings'
          >
            ⚙️
          </button>
        </div>
        <div className={styles.phaseIndicator}>
          {isLobby && getStr('host', 'phaseLobby')}
          {phase === GamePhase.DAY && `DAY ${gameState?.dayCount}`}
          {phase === GamePhase.NIGHT && `NIGHT ${gameState?.dayCount}`}
          {isGameOver && getStr('host', 'phaseGameOver')}
        </div>
      </header>

      <section className={styles.section}>
        <h2>
          Game Control
          <span className={`${styles.connectionBadge} ${connected ? styles.connected : styles.disconnected}`}>
            {connected ? getStr('player', 'online') : getStr('player', 'offline')}
          </span>
        </h2>
        <div className={styles.buttonGroup}>
          {isLobby && (
            <button
              className='primary'
              onClick={handleStartGame}
              disabled={!gameState?.players || gameState.players.length < 4}
            >
              {getStr('host', 'startGame')}
            </button>
          )}

          {isLobby && gameState?.players?.some((p) => p.preAssignedRole) && (
            <button onClick={handleRandomizeRoles}>{getStr('host', 'shuffleRoles')}</button>
          )}

          {!isLobby && !isGameOver && (
            <button onClick={handlePushPhaseSlide}>
              {phase === GamePhase.DAY
                ? `DAY ${gameState?.dayCount}`
                : `NIGHT ${gameState?.dayCount}`}
            </button>
          )}

          {!isLobby && !isGameOver && (
            <button onClick={handleNextPhase}>{getStr('host', 'nextPhase')}</button>
          )}

          <button className='danger' onClick={handleResetGame}>
            {getStr('host', 'reset')}
          </button>
        </div>
      </section>

      {gameState?.players?.filter((p) => p.heartbeat?.active).length >= 1 && (
        <section className={styles.section}>
          <button onClick={() => setShowHeartbeat(true)}>{getStr('host', 'btnHeartbeats')}</button>
        </section>
      )}

      <section className={styles.section}>
        <button onClick={() => setShowTutorialSlides(true)}>
          {getStr('host', 'btnTutorials')}
        </button>
        <button onClick={handlePushScoreSlide}>{getStr('host', 'btnScoreboard')}</button>
        <button
          className={gameState?.heartbeatMode ? 'primary' : ''}
          onClick={() => send(ClientMsg.TOGGLE_HEARTBEAT_MODE)}
        >
          {getStr('host', 'btnHeartbeatMode')}
        </button>
        {gameState?.heartbeatMode && Object.values(hostSettings?.heartbeatCalibration || {}).some(c => c.simulated) && (
          <label className={styles.simsLose}>
            <input
              type="checkbox"
              checked={hostSettings?.simsCanLose ?? false}
              onChange={e => send(ClientMsg.SAVE_HOST_SETTINGS, { simsCanLose: e.target.checked })}
            />
            <span>{getStr('host', 'calibration.simsCanLose')}</span>
          </label>
        )}
      </section>

      {!isLobby && !isGameOver && (
        <EventPanel
          pendingEvents={gameState?.pendingEvents || []}
          activeEvents={gameState?.activeEvents || []}
          eventProgress={gameState?.eventProgress || {}}
          eventMetadata={gameState?.eventMetadata || {}}
          currentPhase={phase}
          onStartEvent={handleStartEvent}
          onStartAllEvents={handleStartAllEvents}
          onCreateCustomEvent={handleCreateCustomEvent}
          onResolveEvent={handleResolveEvent}
          onResolveAllEvents={handleResolveAllEvents}
          onSkipEvent={handleSkipEvent}
          onResetEvent={handleResetEvent}
          onDebugAutoSelectAll={handleDebugAutoSelectAll}
          onStartEventTimer={handleStartEventTimer}
          timerDuration={timerDuration}
        />
      )}

      <SlideControls
        slideQueue={slideQueue}
        onNext={handleNextSlide}
        onPrev={handlePrevSlide}
        onClear={handleClearSlides}
        autoAdvanceEnabled={autoAdvanceEnabled}
        onToggleAutoAdvance={handleToggleAutoAdvance}
      />
    </>
  );

  const playersPanel = (
    <PlayerGrid
      players={gameState?.players || []}
      eventParticipants={gameState?.eventParticipants || {}}
      eventProgress={gameState?.eventProgress || {}}
      isLobby={isLobby}
      onKill={handleKillPlayer}
      onRevive={handleRevivePlayer}
      onKick={handleKickPlayer}
      onSetName={handleSetName}
      onSetPortrait={handleSetPortrait}
      onGiveItem={handleGiveItem}
      onRemoveItem={handleRemoveItem}
      onChangeRole={handleChangeRole}
      onPreAssignRole={handlePreAssignRole}
      onDebugAutoSelect={handleDebugAutoSelect}
    />
  );

  return (
    <div className={styles.container}>
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        presets={gamePresets}
        onSavePreset={handleSaveGamePreset}
        onLoadPreset={handleLoadGamePreset}
        onDeletePreset={handleDeleteGamePreset}
        defaultPresetId={hostSettings?.defaultPresetId ?? null}
        onSetDefault={handleSetDefaultPreset}
        timerDuration={timerDuration}
        onTimerDurationChange={handleTimerDurationChange}
        onOpenCalibration={() => { setShowSettings(false); setShowCalibration(true); }}
        onOpenScores={() => { setShowSettings(false); setShowScores(true); }}
      />

      <TutorialSlidesModal
        isOpen={showTutorialSlides}
        onClose={() => setShowTutorialSlides(false)}
        players={gameState?.players || []}
        onPushCompSlide={handlePushCompSlide}
        onPushRoleTipSlide={handlePushRoleTipSlide}
        onPushItemTipSlide={handlePushItemTipSlide}
      />

      <HeartbeatModal
        isOpen={showHeartbeat}
        onClose={() => setShowHeartbeat(false)}
        players={gameState?.players || []}
        onPushHeartbeatSlide={handlePushHeartbeatSlide}
      />

      <CalibrationModal
        isOpen={showCalibration}
        onClose={() => setShowCalibration(false)}
        players={gameState?.players || []}
        calibrationState={calibrationState}
        hostSettings={hostSettings}
        send={send}
      />

      <ScoresModal
        isOpen={showScores}
        onClose={() => setShowScores(false)}
        players={gameState?.players || []}
        scores={scores}
        onSetScore={handleSetScore}
        scoringConfig={hostSettings?.scoringConfig}
        onScoringConfigChange={handleScoringConfigChange}
      />

      {/* Firmware update banner */}
      {(() => {
        const fw = gameState?.availableFirmware;
        const players = gameState?.players || [];
        const outdated = players.filter(
          p => p.terminalConnected && p.terminalFirmware && p.terminalFirmware !== fw
        );
        const terminalCount = outdated.reduce((n, p) => n + (p.terminalCount || 1), 0);
        if (!fw || outdated.length === 0) return null;
        return (
          <div className={styles.firmwareBanner}>
            <span>
              {terminalCount} terminal{terminalCount > 1 ? 's' : ''} on old firmware
              ({outdated.map(p => `P${p.seatNumber}:${p.terminalFirmware}`).join(', ')}
              → {fw})
            </span>
            <button onClick={() => send(ClientMsg.TRIGGER_FIRMWARE_UPDATE)}>
              UPDATE FIRMWARE
            </button>
          </div>
        );
      })()}

      {/* Notifications */}
      <div className='notifications'>
        {notifications.map((n) => (
          <div key={n.id} className={`notification ${n.type}`}>
            {n.message}
          </div>
        ))}
      </div>

      {/* Desktop layout (3-column grid) */}
      <div className={styles.layout}>
        <aside className={styles.sidebar}>{controlsPanel}</aside>
        <main className={styles.main}>
          {playersPanel}
          <div className={styles.screenPreviewBar}>
            <button
              className={styles.screenPreviewToggle}
              onClick={() => toggleScreenPreview()}
            >
              {showScreenPreview ? '▲' : '▼'} SCREEN
            </button>
          </div>
          {showScreenPreview && <ScreenPreview />}
          <div className={styles.screenPreviewBar}>
            <button
              className={styles.screenPreviewToggle}
              onClick={() => setShowOperator(v => !v)}
            >
              {showOperator ? '▲' : '▼'} OPERATOR
              {operatorState?.ready ? (
                <span className={styles.operatorReadyDot}> ● READY</span>
              ) : null}
            </button>
            <button
              className={styles.operatorSendBtn}
              disabled={!(operatorState?.words?.length > 0)}
              onClick={() => send(ClientMsg.OPERATOR_SEND)}
            >
              👻
            </button>
          </div>
          {showOperator && (
            <div
              className={`${styles.operatorPanel} ${operatorState?.ready ? styles.operatorReady : ''}`}
            >
              <div className={styles.operatorMessage}>
                {operatorState?.words?.length > 0 ? (
                  operatorState.words.join(' ')
                ) : (
                  <span className={styles.operatorEmpty}>{getStr('host', 'noMessage')}</span>
                )}
              </div>
            </div>
          )}
        </main>
        <aside className={styles.logPanel}>
          <GameLog entries={log} />
        </aside>
      </div>

      {/* Mobile layout (swipeable panels + bottom nav) */}
      <div
        className={styles.mobileLayout}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className={styles.mobileTrack}
          style={{ transform: `translateX(-${mobileTab * 100}vw)` }}
        >
          <div className={styles.mobilePanel}>{controlsPanel}</div>
          <div className={styles.mobilePanel}>{playersPanel}</div>
          <div className={styles.mobilePanel}>
            <GameLog entries={log} autoScroll={mobileTab === TAB_LOG} />
          </div>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className={styles.mobileNav}>
        {TAB_LABELS().map((label, i) => (
          <button
            key={label}
            className={`${styles.mobileNavBtn} ${mobileTab === i ? styles.mobileNavActive : ''}`}
            onClick={() => setMobileTab(i)}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
