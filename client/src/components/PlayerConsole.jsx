// client/src/components/PlayerConsole.jsx
import { GamePhase, PlayerStatus } from '@shared/constants.js';
import styles from './PlayerConsole.module.css';

export default function PlayerConsole({
  player,
  gameState,
  eventPrompt,
  selectedTarget,
  confirmedTarget,
  hasActiveEvent,
  onSwipeUp,
  onSwipeDown,
  onConfirm,
  onCancel,
  onUseItem,
}) {
  const isAlive = player?.status === PlayerStatus.ALIVE;
  const isDead = player?.status === PlayerStatus.DEAD;
  const phase = gameState?.phase;

  // Determine what to show on the tiny screen
  const getTinyScreenContent = () => {
    if (!gameState) return { primary: 'CONNECTING...', secondary: '' };

    if (phase === GamePhase.LOBBY) {
      return {
        primary: 'WAITING',
        secondary: 'Game will begin soon',
      };
    }

    if (phase === GamePhase.GAME_OVER) {
      return {
        primary: 'GAME OVER',
        secondary: 'Thanks for playing',
      };
    }

    if (isDead) {
      return {
        primary: 'ELIMINATED',
        secondary: 'You are now a spectator',
      };
    }

    if (confirmedTarget) {
      return {
        primary: confirmedTarget.name.toUpperCase(),
        secondary: 'Selection locked in',
        locked: true,
      };
    }

    if (selectedTarget) {
      return {
        primary: selectedTarget.name.toUpperCase(),
        secondary: 'Swipe to change • Press to confirm',
      };
    }

    if (eventPrompt) {
      return {
        primary: eventPrompt.eventName.toUpperCase(),
        secondary: eventPrompt.description,
        waiting: true,
      };
    }

    if (hasActiveEvent) {
      return {
        primary: 'SWIPE TO SELECT',
        secondary: 'Choose a target',
      };
    }

    // Idle state
    if (phase === GamePhase.DAY) {
      return {
        primary: `DAY ${gameState.dayCount}`,
        secondary: 'Discuss with others',
      };
    }

    if (phase === GamePhase.NIGHT) {
      return {
        primary: `NIGHT ${gameState.dayCount}`,
        secondary: 'Waiting for your turn...',
      };
    }

    return { primary: 'STANDBY', secondary: '' };
  };

  const tinyScreen = getTinyScreenContent();

  return (
    <div className={`${styles.console} ${isDead ? styles.dead : ''}`}>
      {/* Header with player identity */}
      <header className={styles.header}>
        <div className={styles.seatNumber}>#{player?.seatNumber}</div>
        <div className={styles.playerName}>{player?.name}</div>
        {player?.roleName && (
          <div
            className={styles.role}
            style={{ color: player.roleColor }}
          >
            {player.roleName}
          </div>
        )}
      </header>

      {/* Inventory Display */}
      {player?.inventory && player.inventory.length > 0 && (
        <div className={styles.inventory}>
          <div className={styles.inventoryLabel}>INVENTORY</div>
          <div className={styles.inventoryItems}>
            {player.inventory.map((item, idx) => (
              <div key={idx} className={styles.inventoryItem}>
                <span className={styles.itemIcon}>🔫</span>
                <span className={styles.itemDetails}>
                  <span className={styles.itemName}>{item.id.toUpperCase()}</span>
                  <span className={styles.itemUses}>
                    {item.uses}/{item.maxUses} uses
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tiny Screen Display */}
      <div className={`${styles.tinyScreen} ${tinyScreen.locked ? styles.locked : ''} ${tinyScreen.waiting ? styles.waiting : ''}`}>
        <div className={styles.screenPrimary}>{tinyScreen.primary}</div>
        <div className={styles.screenSecondary}>{tinyScreen.secondary}</div>
      </div>

      {/* Navigation Controls */}
      <div className={styles.controls}>
        {hasActiveEvent && isAlive && !confirmedTarget && (
          <>
            <button 
              className={styles.navButton}
              onClick={onSwipeUp}
              aria-label="Previous target"
            >
              <span className={styles.arrow}>▲</span>
              <span className={styles.navLabel}>UP</span>
            </button>

            <button 
              className={`${styles.confirmButton} ${selectedTarget ? styles.active : ''}`}
              onClick={onConfirm}
              disabled={!selectedTarget}
              aria-label="Confirm selection"
            >
              CONFIRM
            </button>

            <button 
              className={styles.navButton}
              onClick={onSwipeDown}
              aria-label="Next target"
            >
              <span className={styles.arrow}>▼</span>
              <span className={styles.navLabel}>DOWN</span>
            </button>
          </>
        )}

        {confirmedTarget && isAlive && (
          <button 
            className={styles.cancelButton}
            onClick={onCancel}
            aria-label="Cancel selection"
          >
            CHANGE SELECTION
          </button>
        )}

        {isDead && (
          <div className={styles.spectatorMessage}>
            Spectator Mode
          </div>
        )}

        {!hasActiveEvent && isAlive && phase !== GamePhase.LOBBY && (
          <div className={styles.idleMessage}>
            Waiting for event...
          </div>
        )}
      </div>

      {/* Item Action Buttons */}
      {!hasActiveEvent && isAlive && player?.inventory && player.inventory.length > 0 && (
        <div className={styles.itemActions}>
          {player.inventory.map((item, idx) => {
            const canUse = item.uses > 0;
            const isCorrectPhase =
              (item.id === 'pistol' && phase === GamePhase.DAY);

            return (
              <button
                key={idx}
                className={`${styles.itemActionBtn} ${!canUse || !isCorrectPhase ? styles.disabled : ''}`}
                onClick={() => onUseItem && onUseItem(item.id)}
                disabled={!canUse || !isCorrectPhase}
              >
                <span className={styles.itemActionIcon}>🔫</span>
                <span className={styles.itemActionText}>
                  SHOOT
                  {!isCorrectPhase && phase !== GamePhase.LOBBY && (
                    <span className={styles.itemActionHint}> (day only)</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Status bar */}
      <footer className={styles.statusBar}>
        <span className={`${styles.statusDot} ${isAlive ? styles.alive : styles.dead}`} />
        <span className={styles.statusText}>
          {isAlive ? 'ACTIVE' : 'ELIMINATED'}
        </span>
        {phase && (
          <span className={styles.phase}>
            {phase === GamePhase.DAY ? '☀' : phase === GamePhase.NIGHT ? '☾' : ''}
          </span>
        )}
      </footer>
    </div>
  );
}
