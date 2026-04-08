// client/src/components/SettingsModal.jsx
import { useState } from 'react';
import Modal from './Modal';
import styles from './SettingsModal.module.css';
import { ROLE_DISPLAY, RoleId } from '@shared/constants.js';
import { getStr } from '../strings/index.js';

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
  elderRecruitRole = 'child',
  onElderRecruitRoleChange,
  elderRecruitThreshold = 2,
  onElderRecruitThresholdChange,
  onOpenCalibration,
  onOpenScores,
  hostSettings = {},
  onSaveSettings,
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
          <h3>Game Rules</h3>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={hostSettings?.poisonKillsGeneric ?? false}
              onChange={e => onSaveSettings?.({ poisonKillsGeneric: e.target.checked })}
            />
            <span>Poison kills generic (hide cause of death)</span>
          </label>
        </section>

        <section className={styles.section}>
          <h3>Elder Recruit</h3>
          <p className={styles.settingDesc}>When the Elder starts as the only Child, they recruit instead of killing. These settings control how that works.</p>
          <label className={styles.settingRow}>
            <span>Recruited role</span>
            <select
              value={elderRecruitRole}
              onChange={e => onElderRecruitRoleChange?.(e.target.value)}
            >
              <option value={RoleId.CHILD}>{ROLE_DISPLAY[RoleId.CHILD]?.name ?? 'Child'}</option>
              <option value={RoleId.BITTER}>{ROLE_DISPLAY[RoleId.BITTER]?.name ?? 'Bitter'}</option>
              <option value={RoleId.SILENT}>{ROLE_DISPLAY[RoleId.SILENT]?.name ?? 'Silent'}</option>
              <option value={RoleId.HIDDEN}>{ROLE_DISPLAY[RoleId.HIDDEN]?.name ?? 'Hidden'}</option>
            </select>
          </label>
          <label className={styles.settingRow}>
            <span>Switch to kill when Children reach</span>
            <input
              type="number"
              min="1"
              max="10"
              className={styles.timerInput}
              value={elderRecruitThreshold}
              onChange={e => onElderRecruitThresholdChange?.(parseInt(e.target.value) || 2)}
            />
          </label>
        </section>

        <section className={styles.section}>
          <h3>Heartbeat Mode</h3>
          <button onClick={onOpenCalibration}>
            {getStr('host', 'btnCalibrateHR')}
          </button>
        </section>

        <section className={styles.section}>
          <h3>Scoring</h3>
          <button onClick={onOpenScores}>
            {getStr('host', 'btnScoreboard')}
          </button>
        </section>

      </div>
    </Modal>
  );
}
