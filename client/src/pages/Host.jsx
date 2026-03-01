// client/src/pages/Host.jsx
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { ClientMsg, GamePhase, AUTO_ADVANCE_DELAY } from '@shared/constants.js';
import PlayerGrid from '../components/PlayerGrid';
import EventPanel from '../components/EventPanel';
import SlideControls from '../components/SlideControls';
import GameLog from '../components/GameLog';
import SettingsModal from '../components/SettingsModal';
import TutorialSlidesModal from '../components/TutorialSlidesModal';
import styles from './Host.module.css';

const TAB_CONTROLS = 0;
const TAB_PLAYERS = 1;
const TAB_LOG = 2;
const TAB_LABELS = ['Controls', 'Players', 'Log'];
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
  } = useGame();

  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(false);
  const [timerDuration, setTimerDuration] = useState(30);
  const [loadedPresetId, setLoadedPresetId] = useState(null);
  const hostSettingsApplied = useRef(false);
  const autoAdvanceTimerRef = useRef(null);
  const autoAdvancePausedRef = useRef(false);
  const prevQueueLengthRef = useRef(0);

  const [showSettings, setShowSettings] = useState(false);
  const [showTutorialSlides, setShowTutorialSlides] = useState(false);

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
  }, [loadedPreset, timerDuration, autoAdvanceEnabled, gameState?.players]);

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

    if (canAdvance && !autoAdvancePausedRef.current) {
      autoAdvanceTimerRef.current = setTimeout(() => {
        send(ClientMsg.NEXT_SLIDE);
      }, AUTO_ADVANCE_DELAY);
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
    if (window.confirm('Reset the game? This cannot be undone.')) {
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
    if (window.confirm('Remove this player?')) {
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

  const handlePushHeartbeatSlide = (playerId) =>
    send(ClientMsg.PUSH_HEARTBEAT_SLIDE, { playerId });

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
              {isDirty ? (
                <>
                  <span className={styles.presetStatusChanged}>changed</span>
                  <button
                    className={styles.presetSaveBtn}
                    onClick={handleQuickSavePreset}
                    title='Update preset'
                  >
                    💾
                  </button>
                </>
              ) : (
                <span className={styles.presetStatusUnchanged}>unchanged</span>
              )}
            </div>
          )}
        </div>
        <div className={styles.navLinks}>
          <Link to='/screen'>Screen</Link>
          <Link to='/debug'>Debug</Link>
          <Link to='/operator'>Operator</Link>
          <button
            className={styles.navButton}
            onClick={() => setShowSettings(true)}
          >
            Settings
          </button>
        </div>
        <div className={styles.phaseIndicator}>
          {isLobby && 'LOBBY'}
          {phase === GamePhase.DAY && `DAY ${gameState?.dayCount}`}
          {phase === GamePhase.NIGHT && `NIGHT ${gameState?.dayCount}`}
          {isGameOver && 'GAME OVER'}
        </div>
      </header>

      <section className={styles.section}>
        <h2>Game Control</h2>
        <div className={styles.buttonGroup}>
          {isLobby && (
            <button
              className='primary'
              onClick={handleStartGame}
              disabled={!gameState?.players || gameState.players.length < 4}
            >
              Start Game
            </button>
          )}

          {isLobby && gameState?.players?.some((p) => p.preAssignedRole) && (
            <button onClick={handleRandomizeRoles}>Shuffle Roles</button>
          )}

          {!isLobby && !isGameOver && (
            <button onClick={handleNextPhase}>Next Phase</button>
          )}

          <button className='danger' onClick={handleResetGame}>
            Reset
          </button>
        </div>
      </section>

      {gameState?.players?.some((p) => p.heartbeat?.active) && (
        <section className={styles.section}>
          <h2>Heartbeat</h2>
          <div className={styles.buttonGroup}>
            {gameState.players
              .filter((p) => p.heartbeat?.active)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePushHeartbeatSlide(p.id)}
                >
                  ❤️ {p.name} ({p.heartbeat.bpm})
                </button>
              ))}
          </div>
        </section>
      )}

      <section className={styles.section}>
        <button onClick={() => setShowTutorialSlides(true)}>
          Tutorial Slides...
        </button>
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

      {/* Operator message feed */}
      <div
        className={`${styles.operatorPanel} ${operatorState?.ready ? styles.operatorReady : ''}`}
      >
        <div className={styles.operatorHeader}>
          <div className={styles.operatorLabel}>
            OPERATOR
            {operatorState?.ready ? (
              <span className={styles.operatorReadyDot}> ● READY</span>
            ) : null}
          </div>
          <button
            className={styles.operatorSendBtn}
            disabled={!(operatorState?.words?.length > 0)}
            onClick={() => send(ClientMsg.OPERATOR_SEND)}
          >
            👻
          </button>
        </div>
        <div className={styles.operatorMessage}>
          {operatorState?.words?.length > 0 ? (
            operatorState.words.join(' ')
          ) : (
            <span className={styles.operatorEmpty}>no message</span>
          )}
        </div>
      </div>

      <SlideControls
        slideQueue={slideQueue}
        onNext={handleNextSlide}
        onPrev={handlePrevSlide}
        onClear={handleClearSlides}
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
        autoAdvanceEnabled={autoAdvanceEnabled}
        onToggleAutoAdvance={handleToggleAutoAdvance}
      />

      <TutorialSlidesModal
        isOpen={showTutorialSlides}
        onClose={() => setShowTutorialSlides(false)}
        players={gameState?.players || []}
        onPushCompSlide={handlePushCompSlide}
        onPushRoleTipSlide={handlePushRoleTipSlide}
        onPushItemTipSlide={handlePushItemTipSlide}
      />

      {/* Connection indicator */}
      <div
        className={`connection-badge ${
          connected ? 'connected' : 'disconnected'
        }`}
      >
        {connected ? '● ONLINE' : '○ OFFLINE'}
      </div>

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
        <main className={styles.main}>{playersPanel}</main>
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
        {TAB_LABELS.map((label, i) => (
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
