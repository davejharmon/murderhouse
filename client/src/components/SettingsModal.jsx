// client/src/components/SettingsModal.jsx
import { useState } from 'react';
import Modal from './Modal';
import styles from './SettingsModal.module.css';
import { ROLE_DISPLAY } from '@shared/constants.js';

function presetRoleSummary(preset) {
  const playerCount = Object.keys(preset.players ?? {}).length;
  const mode = preset.roleMode || 'random';
  if (mode === 'assigned' && preset.roleAssignments) {
    const roles = Object.values(preset.roleAssignments)
      .map(id => ROLE_DISPLAY[id]?.emoji ?? '?')
      .join('');
    return `${playerCount}p · ${roles}`;
  }
  if (preset.rolePool) {
    return `${playerCount}p · random (${preset.rolePool.length})`;
  }
  return `${playerCount}p`;
}

export default function SettingsModal({
  isOpen,
  onClose,
  presets = [],
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
  defaultPresetId = null,
  onSetDefault,
  timerDuration,
  onTimerDurationChange,
  autoAdvanceEnabled,
  onToggleAutoAdvance,
  connectedPlayers = [],
  scores = {},
  onSetScore,
}) {
  const [newPresetName, setNewPresetName] = useState('');

  const handleSave = () => {
    const name = newPresetName.trim();
    if (!name) return;
    const existing = presets.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!window.confirm(`A preset named "${existing.name}" already exists. Overwrite it?`)) return;
      onSavePreset(name, existing.id);
    } else {
      onSavePreset(name);
    }
    setNewPresetName('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="SETTINGS">
      <div className={styles.sections}>

        <section className={styles.section}>
          <h3>Game Presets</h3>
          <div className={styles.presetList}>
            {presets.length === 0 ? (
              <div className={styles.presetEmpty}>No presets saved</div>
            ) : (
              presets.map(preset => (
                <div key={preset.id} className={styles.presetItem}>
                  <button
                    className={`${styles.presetBtn} ${styles.presetBtnStar}`}
                    onClick={() => onSetDefault(preset.id)}
                    title={defaultPresetId === preset.id ? 'Remove default' : 'Set as default (auto-loads on server start)'}
                  >
                    {defaultPresetId === preset.id ? '⭐' : '☆'}
                  </button>
                  <div className={styles.presetInfo}>
                    <span className={styles.presetName}>{preset.name}</span>
                    <span className={styles.presetMeta}>{presetRoleSummary(preset)}</span>
                  </div>
                  <div className={styles.presetActions}>
                    <button className={styles.presetBtn} onClick={() => onLoadPreset(preset.id)}>
                      Load
                    </button>
                    <button
                      className={`${styles.presetBtn} ${styles.presetBtnDelete}`}
                      onClick={() => onDeletePreset(preset.id)}
                      title="Delete preset"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className={styles.presetSaveRow}>
            <input
              type="text"
              className={styles.presetNameInput}
              placeholder="Preset name..."
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={40}
            />
            <button onClick={handleSave} disabled={!newPresetName.trim()}>
              Save
            </button>
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

        <section className={styles.section}>
          <h3>Scores</h3>
          {connectedPlayers.length === 0 ? (
            <div className={styles.presetEmpty}>No players connected</div>
          ) : (
            <div className={styles.scoreList}>
              {connectedPlayers.map(p => {
                const score = scores[p.name] ?? 0;
                return (
                  <div key={p.id} className={styles.scoreRow}>
                    <span className={styles.scoreName}>{p.name || `P${p.id}`}</span>
                    <button
                      className={styles.scoreBtn}
                      onClick={() => onSetScore(p.name, score - 1)}
                      disabled={!p.name}
                    >−</button>
                    <span className={styles.scoreValue}>{score}</span>
                    <button
                      className={styles.scoreBtn}
                      onClick={() => onSetScore(p.name, score + 1)}
                      disabled={!p.name}
                    >+</button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </Modal>
  );
}
