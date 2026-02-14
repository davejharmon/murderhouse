// client/src/components/PlayerConsole.jsx
// Simplified console mimicking physical ESP32 terminal experience
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
  onIdleScrollUp,
  onIdleScrollDown,
  compact = false,
}) {
  const isAlive = player?.status === PlayerStatus.ALIVE;
  const isDead = player?.status === PlayerStatus.DEAD;
  const phase = gameState?.phase;

  // Derive idle state from server data (no active event, alive, in-game)
  const isIdle = !hasActiveEvent && isAlive && phase !== GamePhase.LOBBY && phase !== GamePhase.GAME_OVER;

  // Get current icon data from display state
  const icons = player?.display?.icons;
  const idleScrollIndex = player?.display?.idleScrollIndex ?? 0;

  // Check if current scroll position is on a usable item
  const currentIconSlot = icons?.[idleScrollIndex];
  const isOnUsableItem = isIdle && idleScrollIndex > 0 && currentIconSlot?.state === 'active' && currentIconSlot?.id !== 'empty';

  // Check if scrolled item has startsEvent (only those are YES-activatable)
  const scrolledItem = isOnUsableItem
    ? player?.inventory?.[idleScrollIndex - 1]
    : null;
  const canActivateItem = scrolledItem?.startsEvent && (scrolledItem.maxUses === -1 || scrolledItem.uses > 0);

  // Handle UP button (rotary switch increment)
  const handleUp = () => {
    if (isIdle) {
      onIdleScrollUp?.();
    } else if (hasActiveEvent) {
      onSwipeUp();
    }
  };

  // Handle DOWN button (rotary switch decrement)
  const handleDown = () => {
    if (isIdle) {
      onIdleScrollDown?.();
    } else if (hasActiveEvent) {
      onSwipeDown();
    }
  };

  // Handle YES button
  const handleYes = () => {
    if (isIdle && canActivateItem) {
      onUseItem(scrolledItem.id);
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
  const yesEnabled = (hasActiveEvent && selectedTarget && !confirmedTarget && !abstained) || (isIdle && canActivateItem);
  const canAbstain = eventPrompt?.allowAbstain !== false;
  const noEnabled = hasActiveEvent && !confirmedTarget && !abstained && canAbstain;
  const navEnabled = (hasActiveEvent && !confirmedTarget && !abstained) || isIdle;

  return (
    <div className={`${styles.console} ${isDead ? styles.dead : ''} ${compact ? styles.compact : ''}`}>
      {/* Indicator LEDs — matches physical terminal panel */}
      <div className={styles.indicators}>
        <div className={styles.powerLed} title="D1 Power" />
        <StatusLed status={player?.display?.statusLed} />
        <span className={styles.playerLabel}>#{player?.seatNumber} {player?.name}</span>
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
            <span className={styles.arrow}>&#9650;</span>
          </button>

          {/* DOWN - Rotary decrement */}
          <button
            className={styles.navButton}
            onClick={handleDown}
            disabled={!navEnabled}
          >
            <span className={styles.arrow}>&#9660;</span>
          </button>

          {/* YES - Yellow LED button */}
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
