// client/src/components/TutorialSlidesModal.jsx
import { useState } from 'react';
import { ROLE_DISPLAY, ITEM_DISPLAY, AVAILABLE_ROLES, AVAILABLE_ITEMS } from '@shared/constants.js';
import Modal from './Modal';
import styles from './TutorialSlidesModal.module.css';

export default function TutorialSlidesModal({
  isOpen,
  onClose,
  players,
  onPushCompSlide,
  onPushRoleTipSlide,
  onPushItemTipSlide,
}) {
  const [expanded, setExpanded] = useState(false);

  // Roles currently in the game (pre-assigned in lobby, or active role in game)
  const gameRoles = [...new Set(
    (players || [])
      .map(p => p.preAssignedRole || p.role)
      .filter(Boolean)
  )];

  const rolesToShow = expanded ? AVAILABLE_ROLES : gameRoles;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="TUTORIAL SLIDES">
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>ROLES</span>
          {!expanded && gameRoles.length > 0 && (
            <span className={styles.sectionHint}>in game</span>
          )}
          <button
            className={styles.expandBtn}
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? '▲ in game' : '▼ all roles'}
          </button>
        </div>
        <div className={styles.buttonGroup}>
          {rolesToShow.map(roleId => {
            const display = ROLE_DISPLAY[roleId];
            const inGame = gameRoles.includes(roleId);
            return display ? (
              <button
                key={roleId}
                className={expanded && !inGame ? styles.dimmed : ''}
                onClick={() => { onPushRoleTipSlide(roleId); onClose(); }}
              >
                {display.emoji} {display.name}
              </button>
            ) : null;
          })}
          {rolesToShow.length === 0 && (
            <p className={styles.empty}>No roles assigned yet</p>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>ITEMS</span>
        </div>
        <div className={styles.buttonGroup}>
          {AVAILABLE_ITEMS.map(itemId => {
            const display = ITEM_DISPLAY[itemId];
            return display ? (
              <button
                key={itemId}
                onClick={() => { onPushItemTipSlide(itemId); onClose(); }}
              >
                {display.emoji} {display.name}
              </button>
            ) : null;
          })}
        </div>
      </div>

      <div className={styles.section}>
        <button onClick={onPushCompSlide}>📋 Reveal Comp</button>
      </div>
    </Modal>
  );
}
