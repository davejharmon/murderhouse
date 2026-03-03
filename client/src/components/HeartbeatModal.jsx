// client/src/components/HeartbeatModal.jsx
import Modal from './Modal';
import styles from './HeartbeatModal.module.css';

export default function HeartbeatModal({ isOpen, onClose, players, onPushHeartbeatSlide }) {
  const activePlayers = (players || []).filter(p => p.heartbeat?.active);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="HEARTBEAT">
      <div className={styles.buttonGroup}>
        {activePlayers.map(p => (
          <button
            key={p.id}
            onClick={() => { onPushHeartbeatSlide(p.id); onClose(); }}
          >
            ❤️ {p.name}
            <span className={styles.bpm}>{p.heartbeat.bpm} BPM</span>
            {p.heartbeat.fake && <span className={styles.debugBadge}>DEBUG</span>}
          </button>
        ))}
      </div>
    </Modal>
  );
}
