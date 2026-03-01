// client/src/components/ItemManagerModal.jsx
import Modal from './Modal';
import { AVAILABLE_ITEMS, ITEM_DISPLAY } from '@shared/constants.js';
import styles from './ItemManagerModal.module.css';

export default function ItemManagerModal({
  isOpen,
  onClose,
  player,
  onGiveItem,
  onRemoveItem,
}) {
  if (!player) return null;

  const inventory = player.inventory || [];
  const hiddenInventory = player.hiddenInventory || [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Items — ${player.name}`}>
      {/* Current inventory */}
      {(inventory.length > 0 || hiddenInventory.length > 0) && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Holding</h3>
          <div className={styles.itemList}>
            {inventory.map((item, idx) => {
              const display = ITEM_DISPLAY[item.id];
              return (
                <div key={idx} className={styles.itemRow} title={display?.description}>
                  <span className={styles.itemEmoji}>{display?.emoji || '?'}</span>
                  <span className={styles.itemName}>{display?.name || item.id}</span>
                  <span className={styles.itemUses}>x{item.uses}</span>
                  <button
                    className={styles.removeBtn}
                    onClick={() => onRemoveItem(player.id, item.id)}
                    title='Remove'
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            {hiddenInventory.map((item, idx) => {
              const display = ITEM_DISPLAY[item.id];
              return (
                <div key={`h${idx}`} className={styles.itemRowHidden} title={display?.description}>
                  <span className={styles.itemEmoji}>{display?.emoji || '?'}</span>
                  <span className={styles.itemName}>{display?.name || item.id}</span>
                  <span className={styles.hiddenBadge}>hidden</span>
                  <button
                    className={styles.removeBtn}
                    onClick={() => onRemoveItem(player.id, item.id)}
                    title='Remove'
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Give items */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Give</h3>
        <div className={styles.giveGrid}>
          {AVAILABLE_ITEMS.map((itemId) => {
            const display = ITEM_DISPLAY[itemId];
            return (
              <button
                key={itemId}
                className={styles.giveBtn}
                onClick={() => onGiveItem(player.id, itemId)}
                title={display?.description}
              >
                <span className={styles.giveBtnEmoji}>{display?.emoji}</span>
                <span className={styles.giveBtnName}>{display?.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
