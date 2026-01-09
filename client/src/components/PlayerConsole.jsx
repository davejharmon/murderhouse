// client/src/components/PlayerConsole.jsx
import { useMemo, useState, useEffect } from 'react';
import { GamePhase, PlayerStatus } from '@shared/constants.js';
import styles from './PlayerConsole.module.css';

// Helper functions for item display
function getItemIcon(itemId) {
  const icons = { pistol: '🔫' };
  return icons[itemId] || '📦';
}

function getItemDescription(itemId) {
  const descriptions = { pistol: 'Shoot a player' };
  return descriptions[itemId] || 'Use this item';
}

export default function PlayerConsole({
  player,
  gameState,
  eventPrompt,
  eventResult,
  selectedTarget,
  confirmedTarget,
  abstained,
  hasActiveEvent,
  onSwipeUp,
  onSwipeDown,
  onConfirm,
  onAbstain,
  onUseItem,
  compact = false,
}) {
  const isAlive = player?.status === PlayerStatus.ALIVE;
  const isDead = player?.status === PlayerStatus.DEAD;
  const phase = gameState?.phase;

  // Build list of usable abilities from inventory
  const abilities = useMemo(() => {
    if (!player?.inventory) return [];

    return player.inventory
      .filter(item => item.uses !== 0 && item.uses !== undefined) // Has uses remaining
      .map(item => ({
        id: item.id,
        name: item.id.toUpperCase(),
        icon: getItemIcon(item.id),
        description: getItemDescription(item.id),
        uses: item.uses,
        maxUses: item.maxUses,
      }));
  }, [player?.inventory]);

  // Track ability selection when not in event
  const [currentAbilityIndex, setCurrentAbilityIndex] = useState(0);

  // Reset ability index when abilities change
  useEffect(() => {
    if (currentAbilityIndex >= abilities.length) {
      setCurrentAbilityIndex(0);
    }
  }, [abilities.length, currentAbilityIndex]);

  // Determine if we're in ability mode (idle with abilities available)
  const inAbilityMode = !hasActiveEvent && isAlive && abilities.length > 0 && phase !== GamePhase.LOBBY;
  const currentAbility = inAbilityMode ? abilities[currentAbilityIndex] : null;

  // Handle UP button
  const handleUp = () => {
    if (inAbilityMode) {
      // Cycle through abilities
      setCurrentAbilityIndex((prev) =>
        prev <= 0 ? abilities.length - 1 : prev - 1
      );
    } else if (hasActiveEvent) {
      // Cycle through targets
      onSwipeUp();
    }
  };

  // Handle DOWN button
  const handleDown = () => {
    if (inAbilityMode) {
      // Cycle through abilities
      setCurrentAbilityIndex((prev) =>
        prev >= abilities.length - 1 ? 0 : prev + 1
      );
    } else if (hasActiveEvent) {
      // Cycle through targets
      onSwipeDown();
    }
  };

  // Handle YES button
  const handleYes = () => {
    if (inAbilityMode && currentAbility) {
      // Trigger ability
      onUseItem(currentAbility.id);
    } else if (hasActiveEvent && selectedTarget && !confirmedTarget && !abstained) {
      // Confirm selection
      onConfirm();
    }
  };

  // Handle NO button
  const handleNo = () => {
    if (hasActiveEvent && !confirmedTarget && !abstained) {
      // Abstain from event
      onAbstain();
    }
    // NO button does nothing in ability mode
  };

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

    // Show eliminated message only if dead AND no active event (hunter revenge exception)
    if (isDead && !hasActiveEvent) {
      return {
        primary: 'ELIMINATED',
        secondary: 'You are now a spectator',
      };
    }

    // Abstained state
    if (abstained) {
      return {
        primary: 'ABSTAINED',
        secondary: 'You chose not to participate',
        locked: true,
      };
    }

    // Confirmed selection state
    if (confirmedTarget) {
      return {
        primary: confirmedTarget.name.toUpperCase(),
        secondary: 'Selection locked in',
        locked: true,
      };
    }

    // Event with selection
    if (selectedTarget && hasActiveEvent) {
      return {
        primary: selectedTarget.name.toUpperCase(),
        secondary: 'YES to confirm • NO to abstain',
      };
    }

    // Event without selection
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
        secondary: 'Choose a target or abstain',
      };
    }

    // Ability mode
    if (inAbilityMode && currentAbility) {
      return {
        primary: `${currentAbility.icon} ${currentAbility.name}`,
        secondary: `${currentAbility.description} • ${currentAbility.uses}/${currentAbility.maxUses} uses`,
        ability: true,
      };
    }

    // Event result (investigation results, etc.)
    if (eventResult && eventResult.message) {
      return {
        primary: '🔮 INVESTIGATION',
        secondary: eventResult.message,
        result: true,
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

  // Determine button states
  const yesEnabled = (hasActiveEvent && selectedTarget && !confirmedTarget && !abstained) || inAbilityMode;
  const noEnabled = hasActiveEvent && !confirmedTarget && !abstained;
  const navEnabled = (hasActiveEvent && !confirmedTarget && !abstained) || inAbilityMode;

  return (
    <div className={`${styles.console} ${isDead ? styles.dead : ''} ${compact ? styles.compact : ''}`}>
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
                <span className={styles.itemIcon}>{getItemIcon(item.id)}</span>
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

      {/* Pack Info Display (for werewolves) */}
      {player?.packInfo && player.packInfo.packMembers.length > 0 && (
        <div className={styles.packInfo}>
          <div className={styles.packLabel}>
            🐺 PACK {player.packInfo.isAlpha ? '(ALPHA)' : '(WEREWOLF)'}
          </div>
          <div className={styles.packMembers}>
            {player.packInfo.packMembers.map((member) => {
              const isConfirmed = member.currentSelection &&
                                   member.currentSelection === member.confirmedSelection;
              const targetName = member.currentSelection
                ? gameState?.players?.find(p => p.id === member.currentSelection)?.name || 'Unknown'
                : null;

              return (
                <div key={member.id} className={styles.packMember}>
                  <div className={styles.packName}>
                    {member.isAlpha ? '👑 ' : '🐺 '}{member.name}
                  </div>
                  {targetName && (
                    <div className={`${styles.packSelection} ${isConfirmed ? styles.confirmed : styles.considering}`}>
                      {isConfirmed ? '✓ ' : '? '}→ {targetName}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tiny Screen Display */}
      <div className={`${styles.tinyScreen} ${tinyScreen.locked ? styles.locked : ''} ${tinyScreen.waiting ? styles.waiting : ''} ${tinyScreen.ability ? styles.ability : ''} ${tinyScreen.result ? styles.result : ''}`}>
        <div className={styles.screenPrimary}>{tinyScreen.primary}</div>
        <div className={styles.screenSecondary}>{tinyScreen.secondary}</div>
      </div>

      {/* Navigation and Action Controls */}
      <div className={styles.controls}>
        {isDead && !hasActiveEvent && (
          <div className={styles.spectatorMessage}>
            Spectator Mode
          </div>
        )}

        {(isAlive || hasActiveEvent) && phase !== GamePhase.LOBBY && (confirmedTarget || abstained || hasActiveEvent || inAbilityMode) && (
          <div className={styles.buttonGrid}>
            {/* UP Button */}
            <button
              className={`${styles.navButton} ${styles.upButton}`}
              onClick={handleUp}
              disabled={!navEnabled}
              aria-label={inAbilityMode ? "Previous ability" : "Previous target"}
            >
              <span className={styles.arrow}>▲</span>
              <span className={styles.navLabel}>UP</span>
            </button>

            {/* YES Button */}
            <button
              className={`${styles.yesButton} ${yesEnabled ? styles.active : ''}`}
              onClick={handleYes}
              disabled={!yesEnabled}
              aria-label={inAbilityMode ? "Use ability" : "Confirm selection"}
            >
              <span className={styles.yesIcon}>✓</span>
              <span className={styles.yesLabel}>YES</span>
            </button>

            {/* DOWN Button */}
            <button
              className={`${styles.navButton} ${styles.downButton}`}
              onClick={handleDown}
              disabled={!navEnabled}
              aria-label={inAbilityMode ? "Next ability" : "Next target"}
            >
              <span className={styles.arrow}>▼</span>
              <span className={styles.navLabel}>DOWN</span>
            </button>

            {/* NO Button */}
            <button
              className={`${styles.noButton} ${noEnabled ? styles.active : ''}`}
              onClick={handleNo}
              disabled={!noEnabled}
              aria-label="Abstain"
            >
              <span className={styles.noIcon}>✗</span>
              <span className={styles.noLabel}>NO</span>
            </button>
          </div>
        )}

        {!hasActiveEvent && !inAbilityMode && isAlive && phase !== GamePhase.LOBBY && (
          <div className={styles.idleMessage}>
            No abilities or events available
          </div>
        )}
      </div>

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
