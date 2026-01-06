// client/src/pages/Player.jsx
import { useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { ClientMsg, GamePhase, PlayerStatus } from '@shared/constants.js';
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
    notifications,
    send,
    joinAsPlayer,
    rejoinAsPlayer,
  } = useGame();

  // Join game on mount
  useEffect(() => {
    if (connected && playerId) {
      // JOIN handles both new players and reconnections
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
        if (diff > 0) {
          handleSwipeUp();
        } else {
          handleSwipeDown();
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleSwipeUp, handleSwipeDown]);

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

  const hasActiveEvent = eventPrompt || playerState.pendingEvents?.length > 0;

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
        selectedTarget={selectedTarget}
        confirmedTarget={confirmedTarget}
        abstained={playerState.abstained}
        hasActiveEvent={hasActiveEvent}
        onSwipeUp={handleSwipeUp}
        onSwipeDown={handleSwipeDown}
        onConfirm={handleConfirm}
        onAbstain={handleAbstain}
        onUseItem={handleUseItem}
      />
    </div>
  );
}
