// client/src/components/PlayerConsole.jsx
// Simplified console mimicking physical ESP32 terminal experience
import { useMemo, useState, useEffect } from 'react';
import { GamePhase, PlayerStatus } from '@shared/constants.js';
import TinyScreen from './TinyScreen';
import StatusLed from './StatusLed';
import styles from './PlayerConsole.module.css';

export default function PlayerConsole({
  player,
  gameState,
  eventPrompt,
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

  // Build list of usable abilities from inventory (only items with startsEvent)
  const abilities = useMemo(() => {
    if (!player?.inventory) return [];

    return player.inventory
      .filter(item =>
        item.uses !== 0 &&
        item.uses !== undefined &&
        item.startsEvent // Only items that start an event when activated
      )
      .map(item => ({
        id: item.id,
        name: item.id.toUpperCase(),
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

  // Handle UP button (rotary switch increment)
  const handleUp = () => {
    if (inAbilityMode) {
      setCurrentAbilityIndex((prev) =>
        prev <= 0 ? abilities.length - 1 : prev - 1
      );
    } else if (hasActiveEvent) {
      onSwipeUp();
    }
  };

  // Handle DOWN button (rotary switch decrement)
  const handleDown = () => {
    if (inAbilityMode) {
      setCurrentAbilityIndex((prev) =>
        prev >= abilities.length - 1 ? 0 : prev + 1
      );
    } else if (hasActiveEvent) {
      onSwipeDown();
    }
  };

  // Handle YES button
  const handleYes = () => {
    if (inAbilityMode && currentAbility) {
      onUseItem(currentAbility.id);
    } else if (hasActiveEvent && selectedTarget && !confirmedTarget && !abstained) {
      onConfirm();
    }
  };

  // Handle NO button
  const handleNo = () => {
    if (hasActiveEvent && !confirmedTarget && !abstained) {
      onAbstain();
    }
  };

  // Server-driven LED states for YES/NO buttons
  const yesLed = player?.display?.leds?.yes || 'off';
  const noLed = player?.display?.leds?.no || 'off';

  // Client-side interactivity (keep disabled logic for touch)
  const yesEnabled = (hasActiveEvent && selectedTarget && !confirmedTarget && !abstained) || inAbilityMode;
  const canAbstain = eventPrompt?.allowAbstain !== false;
  const noEnabled = hasActiveEvent && !confirmedTarget && !abstained && canAbstain;
  const navEnabled = (hasActiveEvent && !confirmedTarget && !abstained) || inAbilityMode;

  return (
    <div className={`${styles.console} ${isDead ? styles.dead : ''} ${compact ? styles.compact : ''}`}>
      {/* Indicator LEDs — matches physical terminal panel */}
      <div className={styles.indicators}>
        <div className={styles.powerLed} title="D1 Power" />
        <StatusLed status={player?.display?.statusLed} />
      </div>

      {/* OLED Display - 256x64 simulation */}
      <TinyScreen display={player?.display} compact={compact} />

      {/* Physical Controls: Always visible like physical buttons */}
      <div className={styles.controls}>
        <div className={styles.buttonRow}>
          {/* UP - Rotary increment */}
          <button
            className={styles.navButton}
            onClick={handleUp}
            disabled={!navEnabled}
          >
            <span className={styles.arrow}>▲</span>
          </button>

          {/* DOWN - Rotary decrement */}
          <button
            className={styles.navButton}
            onClick={handleDown}
            disabled={!navEnabled}
          >
            <span className={styles.arrow}>▼</span>
          </button>

          {/* YES - Green LED button */}
          <button
            className={`${styles.yesButton} ${styles[`led_yes_${yesLed}`] || ''}`}
            onClick={handleYes}
            disabled={!yesEnabled}
          >
            YES
          </button>

          {/* NO - Red LED button */}
          <button
            className={`${styles.noButton} ${styles[`led_no_${noLed}`] || ''}`}
            onClick={handleNo}
            disabled={!noEnabled}
          >
            NO
          </button>
        </div>
      </div>
    </div>
  );
}
