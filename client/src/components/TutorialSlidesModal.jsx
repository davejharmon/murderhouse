// client/src/components/TutorialSlidesModal.jsx
import { ROLE_DISPLAY } from '@shared/constants.js';
import Modal from './Modal';
import styles from './TutorialSlidesModal.module.css';

export default function TutorialSlidesModal({
  isOpen,
  onClose,
  players,
  onPushCompSlide,
  onPushRoleTipSlide,
}) {
  const uniqueRoles = [...new Set(
    (players || [])
      .filter(p => p.preAssignedRole)
      .map(p => p.preAssignedRole)
  )];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="TUTORIAL SLIDES">
      <div className={styles.buttonGroup}>
        <button onClick={onPushCompSlide}>Reveal Comp</button>
        {uniqueRoles.map(roleId => {
          const display = ROLE_DISPLAY[roleId];
          return display ? (
            <button key={roleId} onClick={() => { onPushRoleTipSlide(roleId); onClose(); }}>
              {display.emoji} {display.name}
            </button>
          ) : null;
        })}
      </div>
    </Modal>
  );
}
