// client/src/components/PortraitSelectorModal.jsx
// Modal for selecting player portraits

import { useState } from 'react';
import Modal from './Modal';
import styles from './PortraitSelectorModal.module.css';

const AVAILABLE_PORTRAITS = [
  'player1.png',
  'player2.png',
  'player3.png',
  'player4.png',
  'player5.png',
  'player6.png',
  'player7.png',
  'player8.png',
  'player9.png',
];

export default function PortraitSelectorModal({
  isOpen,
  onClose,
  onSelect,
  currentPortrait,
  playerName,
}) {
  const [selectedPortrait, setSelectedPortrait] = useState(currentPortrait);

  const handleSubmit = () => {
    if (selectedPortrait && selectedPortrait !== currentPortrait) {
      onSelect(selectedPortrait);
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Select Portrait for ${playerName}`}>
      <div className={styles.grid}>
        {AVAILABLE_PORTRAITS.map((portrait) => (
          <div
            key={portrait}
            className={`${styles.portraitOption} ${
              selectedPortrait === portrait ? styles.selected : ''
            }`}
            onClick={() => setSelectedPortrait(portrait)}
          >
            <img
              src={`/images/players/${portrait}`}
              alt={portrait}
              className={styles.portraitImage}
            />
            {selectedPortrait === portrait && (
              <div className={styles.checkmark}>✓</div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.actions}>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.primary}
          onClick={handleSubmit}
          disabled={!selectedPortrait || selectedPortrait === currentPortrait}
        >
          Select Portrait
        </button>
      </div>
    </Modal>
  );
}
