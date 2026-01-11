import { useState } from 'react';
import styles from './CustomEventModal.module.css';

const MECHANISMS = [
  { id: 'vote', name: 'Vote' },
];

export default function CustomEventModal({
  isOpen,
  onClose,
  onSubmit,
  availableItems,
  availableRoles
}) {
  const [mechanism, setMechanism] = useState('vote');
  const [rewardType, setRewardType] = useState('item');
  const [rewardParam, setRewardParam] = useState('');

  if (!isOpen) return null;

  const mechanismLabel = MECHANISMS.find(m => m.id === mechanism)?.name || 'Event';

  const handleSubmit = (e) => {
    e.preventDefault();

    // Build description based on reward type
    let description = '';
    switch (rewardType) {
      case 'item':
        const item = availableItems.find(i => i.id === rewardParam);
        description = `Vote for who receives: ${item?.name || rewardParam}`;
        break;
      case 'role':
        const role = availableRoles.find(r => r.id === rewardParam);
        description = `Vote for who becomes: ${role?.name || rewardParam}`;
        break;
      case 'resurrection':
        description = 'Vote for who to resurrect';
        break;
    }

    onSubmit({
      mechanism,
      rewardType,
      rewardParam: rewardType === 'resurrection' ? null : rewardParam,
      description,
    });

    // Reset form
    setMechanism('vote');
    setRewardType('item');
    setRewardParam('');
  };

  const isValid = rewardType === 'resurrection' || rewardParam !== '';

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <h2>Configure Event</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </header>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Mechanism Selection */}
          <div className={styles.field}>
            <label>Mechanism</label>
            <div className={styles.radioGroup}>
              {MECHANISMS.map(m => (
                <label key={m.id}>
                  <input
                    type="radio"
                    value={m.id}
                    checked={mechanism === m.id}
                    onChange={(e) => setMechanism(e.target.value)}
                  />
                  {m.name}
                </label>
              ))}
            </div>
          </div>

          {/* Reward Type Selection */}
          <div className={styles.field}>
            <label>Reward Type</label>
            <div className={styles.radioGroup}>
              <label>
                <input
                  type="radio"
                  value="item"
                  checked={rewardType === 'item'}
                  onChange={(e) => {
                    setRewardType(e.target.value);
                    setRewardParam('');
                  }}
                />
                Item
              </label>
              <label>
                <input
                  type="radio"
                  value="role"
                  checked={rewardType === 'role'}
                  onChange={(e) => {
                    setRewardType(e.target.value);
                    setRewardParam('');
                  }}
                />
                Role
              </label>
              <label>
                <input
                  type="radio"
                  value="resurrection"
                  checked={rewardType === 'resurrection'}
                  onChange={(e) => {
                    setRewardType(e.target.value);
                    setRewardParam('');
                  }}
                />
                Resurrection
              </label>
            </div>
          </div>

          {/* Conditional Reward Parameter Selection */}
          {rewardType === 'item' && (
            <div className={styles.field}>
              <label>Select Item</label>
              <select
                value={rewardParam}
                onChange={(e) => setRewardParam(e.target.value)}
                required
              >
                <option value="">-- Choose Item --</option>
                {availableItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {rewardType === 'role' && (
            <div className={styles.field}>
              <label>Select Role</label>
              <select
                value={rewardParam}
                onChange={(e) => setRewardParam(e.target.value)}
                required
              >
                <option value="">-- Choose Role --</option>
                {availableRoles.map(role => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {rewardType === 'resurrection' && (
            <div className={styles.info}>
              Players will vote on which dead player to resurrect.
            </div>
          )}

          {/* Submit */}
          <div className={styles.actions}>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.primary} disabled={!isValid}>
              Create {mechanismLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
