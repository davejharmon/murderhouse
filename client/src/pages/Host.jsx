// client/src/pages/Host.jsx
import { useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { ClientMsg, GamePhase } from '@shared/constants.js';
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

  // Connect as host on mount
  useEffect(() => {
    if (connected) {
      connectAsHost();
    }
  }, [connected, connectAsHost]);

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
  const handleStartCustomVote = (config) =>
    send(ClientMsg.START_CUSTOM_VOTE, config);
  const handleResolveEvent = (eventId) =>
    send(ClientMsg.RESOLVE_EVENT, { eventId });
  const handleResolveAllEvents = () => send(ClientMsg.RESOLVE_ALL_EVENTS);

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
  const handleGiveItem = (playerId, itemId) =>
    send(ClientMsg.GIVE_ITEM, { playerId, itemId });
  const handleRemoveItem = (playerId, itemId) =>
    send(ClientMsg.REMOVE_ITEM, { playerId, itemId });

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
            <h1>MURDERHOUSE</h1>
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

              {!isLobby && !isGameOver && (
                <button onClick={handleNextPhase}>Next Phase</button>
              )}

              <button className='danger' onClick={handleResetGame}>
                Reset
              </button>
            </div>
          </section>

          {/* Event Controls */}
          {!isLobby && !isGameOver && (
            <EventPanel
              pendingEvents={gameState?.pendingEvents || []}
              activeEvents={gameState?.activeEvents || []}
              eventProgress={gameState?.eventProgress || {}}
              currentPhase={phase}
              onStartEvent={handleStartEvent}
              onStartAllEvents={handleStartAllEvents}
              onStartCustomVote={handleStartCustomVote}
              onResolveEvent={handleResolveEvent}
              onResolveAllEvents={handleResolveAllEvents}
            />
          )}

          {/* Slide Controls */}
          <SlideControls
            slideQueue={slideQueue}
            onNext={handleNextSlide}
            onPrev={handlePrevSlide}
            onClear={handleClearSlides}
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
            onGiveItem={handleGiveItem}
            onRemoveItem={handleRemoveItem}
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
