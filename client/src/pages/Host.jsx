// client/src/pages/Host.jsx
import { useEffect, useState, useRef, useCallback } from 'react';
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
  } = useGame();

  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(() => {
    const saved = localStorage.getItem('autoAdvanceEnabled');
    return saved ? JSON.parse(saved) : false;
  });
  const [timerDuration, setTimerDuration] = useState(() => {
    return parseInt(localStorage.getItem('timerDuration')) || 30;
  });
  const autoAdvanceTimerRef = useRef(null);

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

  // Persist auto-advance preference to localStorage
  useEffect(() => {
    localStorage.setItem('autoAdvanceEnabled', JSON.stringify(autoAdvanceEnabled));
  }, [autoAdvanceEnabled]);

  // Auto-advance logic
  useEffect(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    if (!autoAdvanceEnabled || !slideQueue) return;

    const { currentIndex = -1, queue = [] } = slideQueue;
    const canAdvance = currentIndex < queue.length - 1;

    if (canAdvance) {
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
    touchRef.current = { startX: touch.clientX, startY: touch.clientY, swiping: false };
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
        return Math.max(prev - 1, 0);               // swipe right → prev
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
  const handleSkipEvent = (eventId) =>
    send(ClientMsg.SKIP_EVENT, { eventId });
  const handleResetEvent = (eventId) =>
    send(ClientMsg.RESET_EVENT, { eventId });
  const handleStartEventTimer = () =>
    send(ClientMsg.START_EVENT_TIMER, { duration: timerDuration * 1000 });
  const handleTimerDurationChange = (seconds) => {
    setTimerDuration(seconds);
    localStorage.setItem('timerDuration', String(seconds));
  };

  const handleNextSlide = () => send(ClientMsg.NEXT_SLIDE);
  const handlePrevSlide = () => send(ClientMsg.PREV_SLIDE);
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
  const handleSavePresets = () => send(ClientMsg.SAVE_PLAYER_PRESETS);
  const handleLoadPresets = () => send(ClientMsg.LOAD_PLAYER_PRESETS);

  const handleChangeRole = (playerId, roleId) =>
    send(ClientMsg.CHANGE_ROLE, { playerId, roleId });
  const handlePreAssignRole = (playerId, roleId) =>
    send(ClientMsg.PRE_ASSIGN_ROLE, { playerId, roleId });
  const handleRandomizeRoles = () => send(ClientMsg.RANDOMIZE_ROLES);
  const handlePushCompSlide = () => send(ClientMsg.PUSH_COMP_SLIDE);
  const handlePushRoleTipSlide = (roleId) =>
    send(ClientMsg.PUSH_ROLE_TIP_SLIDE, { roleId });

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
        <h1>HOST</h1>
        <div className={styles.navLinks}>
          <Link to='/screen'>Screen</Link>
          <Link to='/debug'>Debug</Link>
          <button className={styles.navButton} onClick={() => setShowSettings(true)}>Settings</button>
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

          {isLobby && gameState?.players?.some(p => p.preAssignedRole) && (
            <button onClick={handleRandomizeRoles}>
              Shuffle Roles
            </button>
          )}

          {!isLobby && !isGameOver && (
            <button onClick={handleNextPhase}>Next Phase</button>
          )}

          <button className='danger' onClick={handleResetGame}>
            Reset
          </button>
        </div>
      </section>

      {gameState?.players?.some(p => p.heartbeat?.active) && (
        <section className={styles.section}>
          <h2>Heartbeat</h2>
          <div className={styles.buttonGroup}>
            {gameState.players
              .filter(p => p.heartbeat?.active)
              .map(p => (
                <button key={p.id} onClick={() => handlePushHeartbeatSlide(p.id)}>
                  ❤️ {p.name} ({p.heartbeat.bpm})
                </button>
              ))
            }
          </div>
        </section>
      )}

      {isLobby && gameState?.players?.some(p => p.preAssignedRole) && (
        <section className={styles.section}>
          <button onClick={() => setShowTutorialSlides(true)}>Tutorial Slides...</button>
        </section>
      )}

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
        onSavePresets={handleSavePresets}
        onLoadPresets={handleLoadPresets}
        timerDuration={timerDuration}
        onTimerDurationChange={handleTimerDurationChange}
        autoAdvanceEnabled={autoAdvanceEnabled}
        onToggleAutoAdvance={setAutoAdvanceEnabled}
      />

      <TutorialSlidesModal
        isOpen={showTutorialSlides}
        onClose={() => setShowTutorialSlides(false)}
        players={gameState?.players || []}
        onPushCompSlide={handlePushCompSlide}
        onPushRoleTipSlide={handlePushRoleTipSlide}
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
        <aside className={styles.logPanel}><GameLog entries={log} /></aside>
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
