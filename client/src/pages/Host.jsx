// client/src/pages/Host.jsx
import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { ClientMsg, GamePhase, AUTO_ADVANCE_DELAY, ROLE_DISPLAY } from '@shared/constants.js';
import PlayerGrid from '../components/PlayerGrid';
import EventPanel from '../components/EventPanel';
import SlideControls from '../components/SlideControls';
import GameLog from '../components/GameLog';
import styles from './Host.module.css';

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
    // Load auto-advance preference from localStorage
    const saved = localStorage.getItem('autoAdvanceEnabled');
    return saved ? JSON.parse(saved) : false;
  });
  const autoAdvanceTimerRef = useRef(null);

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
    // Clear any existing timer
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    // Only auto-advance if enabled and there are more slides to show
    if (!autoAdvanceEnabled || !slideQueue) return;

    const { currentIndex = -1, queue = [] } = slideQueue;
    const canAdvance = currentIndex < queue.length - 1;

    if (canAdvance) {
      autoAdvanceTimerRef.current = setTimeout(() => {
        send(ClientMsg.NEXT_SLIDE);
      }, AUTO_ADVANCE_DELAY);
    }

    // Cleanup timer on unmount or when dependencies change
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, [autoAdvanceEnabled, slideQueue, send]);

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
  const handleStartEventTimer = (eventId) =>
    send(ClientMsg.START_EVENT_TIMER, { eventId });

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

  const handlePreAssignRole = (playerId, roleId) =>
    send(ClientMsg.PRE_ASSIGN_ROLE, { playerId, roleId });
  const handleRandomizeRoles = () => send(ClientMsg.RANDOMIZE_ROLES);
  const handlePushCompSlide = () => send(ClientMsg.PUSH_COMP_SLIDE);
  const handlePushRoleTipSlide = (roleId) =>
    send(ClientMsg.PUSH_ROLE_TIP_SLIDE, { roleId });

  const handleDebugAutoSelect = (playerId) =>
    send(ClientMsg.DEBUG_AUTO_SELECT, { playerId });
  const handleDebugAutoSelectAll = (eventId) =>
    send(ClientMsg.DEBUG_AUTO_SELECT_ALL, { eventId });

  return (
    <div className={styles.container}>
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

      <div className={styles.layout}>
        {/* Left Panel - Game Controls */}
        <aside className={styles.sidebar}>
          <header className={styles.header}>
            <h1>HOST</h1>
            <div className={styles.navLinks}>
              <Link to='/screen'>Screen</Link>
              <Link to='/debug'>Debug</Link>
            </div>
            <div className={styles.phaseIndicator}>
              {isLobby && 'LOBBY'}
              {phase === GamePhase.DAY && `DAY ${gameState?.dayCount}`}
              {phase === GamePhase.NIGHT && `NIGHT ${gameState?.dayCount}`}
              {isGameOver && 'GAME OVER'}
            </div>
          </header>

          {/* Game Controls */}
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

          {/* Player Presets */}
          <section className={styles.section}>
            <h2>Player Presets</h2>
            <div className={styles.buttonGroup}>
              <button onClick={handleSavePresets}>Save</button>
              <button onClick={handleLoadPresets}>Load</button>
            </div>
          </section>

          {/* Tutorial Slides */}
          {isLobby && gameState?.players?.some(p => p.preAssignedRole) && (() => {
            const uniqueRoles = [...new Set(
              gameState.players
                .filter(p => p.preAssignedRole)
                .map(p => p.preAssignedRole)
            )];
            return (
              <section className={styles.section}>
                <h2>Tutorial Slides</h2>
                <div className={styles.buttonGroup}>
                  <button onClick={handlePushCompSlide}>Reveal Comp</button>
                  {uniqueRoles.map(roleId => {
                    const display = ROLE_DISPLAY[roleId];
                    return display ? (
                      <button key={roleId} onClick={() => handlePushRoleTipSlide(roleId)}>
                        {display.emoji} {display.name}
                      </button>
                    ) : null;
                  })}
                </div>
              </section>
            );
          })()}

          {/* Event Controls */}
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
            />
          )}

          {/* Slide Controls */}
          <SlideControls
            slideQueue={slideQueue}
            onNext={handleNextSlide}
            onPrev={handlePrevSlide}
            onClear={handleClearSlides}
            autoAdvanceEnabled={autoAdvanceEnabled}
            onToggleAutoAdvance={setAutoAdvanceEnabled}
          />
        </aside>

        {/* Main Content - Player Grid */}
        <main className={styles.main}>
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
            onPreAssignRole={handlePreAssignRole}
            onDebugAutoSelect={handleDebugAutoSelect}
          />
        </main>

        {/* Right Panel - Log */}
        <aside className={styles.logPanel}>
          <GameLog entries={log} />
        </aside>
      </div>
    </div>
  );
}
