// client/src/components/SettingsModal.jsx
import Modal from './Modal';
import styles from './SettingsModal.module.css';

export default function SettingsModal({
  isOpen,
  onClose,
  onSavePresets,
  onLoadPresets,
  timerDuration,
  onTimerDurationChange,
  autoAdvanceEnabled,
  onToggleAutoAdvance,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="SETTINGS">
      <div className={styles.sections}>

        <section className={styles.section}>
          <h3>Player Presets</h3>
          <div className={styles.buttonGroup}>
            <button onClick={onSavePresets}>Save</button>
            <button onClick={onLoadPresets}>Load</button>
          </div>
        </section>

        <section className={styles.section}>
          <h3>Event Timer</h3>
          <div className={styles.timerRow}>
            <input
              type='number'
              min='1'
              max='300'
              value={timerDuration}
              onChange={(e) => onTimerDurationChange(parseInt(e.target.value) || 1)}
              className={styles.timerInput}
              title='Timer duration in seconds'
            />
            <span className={styles.timerUnit}>s</span>
          </div>
        </section>

        <section className={styles.section}>
          <h3>Slide Behaviour</h3>
          <div className={styles.toggle}>
            <label>
              <input
                type='checkbox'
                checked={autoAdvanceEnabled}
                onChange={(e) => onToggleAutoAdvance(e.target.checked)}
              />
              <span>AUTO-ADVANCE</span>
            </label>
          </div>
        </section>

      </div>
    </Modal>
  );
}
