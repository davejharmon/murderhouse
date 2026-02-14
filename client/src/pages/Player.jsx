// client/src/pages/Player.jsx
import { useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { ClientMsg, GamePhase } from '@shared/constants.js';
import PlayerConsole from '../components/PlayerConsole';
import styles from './Player.module.css';

export default function Player() {
  const { id } = useParams();
  const playerId = id;

  const {
    connected,
    gameState,
    playerState,
    eventPrompt,
    eventResult,
    notifications,
    send,
    joinAsPlayer,
    rejoinAsPlayer,
  } = useGame();

  // Set page title
  useEffect(() => {
    document.title = `Player ${playerId} - MURDERHOUSE`;
  }, [playerId]);

  // Join game on mount
  useEffect(() => {
    if (connected && playerId) {
      // JOIN handles both new players and reconnection
      joinAsPlayer(playerId);
    }
  }, [connected, playerId, joinAsPlayer]);

  // Auto-rejoin after game reset
  useEffect(() => {
    // If we're connected but have no playerState, and game is in LOBBY, rejoin
    if (connected && playerId && !playerState && gameState?.phase === GamePhase.LOBBY) {
      console.log('[Player] Detected reset, rejoining...');
      joinAsPlayer(playerId);
    }
  }, [connected, playerId, playerState, gameState?.phase, joinAsPlayer]);

  // Handle swipe gestures
  const handleSwipeUp = useCallback(() => {
    send(ClientMsg.SELECT_UP);
  }, [send]);

  const handleSwipeDown = useCallback(() => {
    send(ClientMsg.SELECT_DOWN);
  }, [send]);

  const handleConfirm = useCallback(() => {
    send(ClientMsg.CONFIRM);
  }, [send]);

  const handleAbstain = useCallback(() => {
    send(ClientMsg.ABSTAIN);
  }, [send]);

  const handleUseItem = useCallback((itemId) => {
    send(ClientMsg.USE_ITEM, { itemId });
  }, [send]);

  const handleIdleScrollUp = useCallback(() => {
    send(ClientMsg.IDLE_SCROLL_UP);
  }, [send]);

  const handleIdleScrollDown = useCallback(() => {
    send(ClientMsg.IDLE_SCROLL_DOWN);
  }, [send]);

  // Derive whether player has an active event
  const hasActiveEvent = eventPrompt || playerState?.pendingEvents?.length > 0;

  // Touch handling for swipe
  useEffect(() => {
    let touchStartY = 0;
    const minSwipeDistance = 50;

    const handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e) => {
      const touchEndY = e.changedTouches[0].clientY;
      const diff = touchStartY - touchEndY;

      if (Math.abs(diff) > minSwipeDistance) {
        if (hasActiveEvent) {
          // During events, swipe selects targets
          if (diff > 0) {
            handleSwipeUp();
          } else {
            handleSwipeDown();
          }
        } else {
          // When idle, swipe scrolls icons
          if (diff > 0) {
            handleIdleScrollUp();
          } else {
            handleIdleScrollDown();
          }
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [hasActiveEvent, handleSwipeUp, handleSwipeDown, handleIdleScrollUp, handleIdleScrollDown]);

  // Loading state
  if (!playerState) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.loadingText}>CONNECTING</div>
          <div className={styles.loadingDots}>...</div>
        </div>
      </div>
    );
  }

  // Get current target if any
  const selectedTarget = playerState.currentSelection
    ? gameState?.players?.find(p => p.id === playerState.currentSelection)
    : null;

  const confirmedTarget = playerState.confirmedSelection
    ? gameState?.players?.find(p => p.id === playerState.confirmedSelection)
    : null;

  return (
    <div className={styles.container}>
      {/* Connection indicator */}
      <div className={`connection-badge ${connected ? 'connected' : 'disconnected'}`}>
        {connected ? '● ONLINE' : '○ OFFLINE'}
      </div>

      {/* Notifications */}
      <div className="notifications">
        {notifications.map(n => (
          <div key={n.id} className={`notification ${n.type}`}>
            {n.message}
          </div>
        ))}
      </div>

      <PlayerConsole
        player={playerState}
        gameState={gameState}
        eventPrompt={eventPrompt}
        eventResult={eventResult}
        selectedTarget={selectedTarget}
        confirmedTarget={confirmedTarget}
        abstained={playerState.abstained}
        hasActiveEvent={hasActiveEvent}
        onSwipeUp={handleSwipeUp}
        onSwipeDown={handleSwipeDown}
        onConfirm={handleConfirm}
        onAbstain={handleAbstain}
        onUseItem={handleUseItem}
        onIdleScrollUp={handleIdleScrollUp}
        onIdleScrollDown={handleIdleScrollDown}
      />
    </div>
  );
}
