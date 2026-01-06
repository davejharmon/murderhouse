// client/src/components/EventPanel.jsx
import { useState } from 'react';
import CustomVoteModal from './CustomVoteModal';
import styles from './EventPanel.module.css';

export default function EventPanel({
  pendingEvents,
  activeEvents,
  eventProgress,
  currentPhase,
  onStartEvent,
  onStartAllEvents,
  onResolveEvent,
  onResolveAllEvents,
  onStartCustomVote,
}) {
  const [showCustomVoteModal, setShowCustomVoteModal] = useState(false);

  const hasPending = pendingEvents.length > 0;
  const hasActive = activeEvents.length > 0;
  const isDayPhase = currentPhase === 'day';
  const customVoteActive = activeEvents.includes('customVote');

  // Hardcoded for now - could be fetched from server
  const availableItems = [
    { id: 'pistol', name: 'Pistol' }
  ];

  const availableRoles = [
    { id: 'villager', name: 'Villager' },
    { id: 'werewolf', name: 'Werewolf' },
    { id: 'seer', name: 'Seer' },
    { id: 'doctor', name: 'Doctor' },
    { id: 'hunter', name: 'Hunter' },
  ];

  const handleCustomVoteSubmit = (config) => {
    onStartCustomVote(config);
    setShowCustomVoteModal(false);
  };

  return (
    <>
      <section className={styles.panel}>
        <h2>Events</h2>

        {/* Custom Vote Button - Only during DAY phase */}
        {isDayPhase && (
          <div className={styles.group}>
            <button
              className={`${styles.eventBtn} ${styles.customVote}`}
              onClick={() => setShowCustomVoteModal(true)}
              disabled={customVoteActive}
            >
              {customVoteActive ? 'Custom Vote Active' : 'Start Custom Vote'}
            </button>
          </div>
        )}

        {/* Pending Events */}
        {hasPending && (
        <div className={styles.group}>
          <div className={styles.label}>Pending</div>
          <div className={styles.eventList}>
            {pendingEvents.map(eventId => (
              <button
                key={eventId}
                className={styles.eventBtn}
                onClick={() => onStartEvent(eventId)}
              >
                Start {eventId}
              </button>
            ))}
          </div>
          {pendingEvents.length > 1 && (
            <button
              className={`${styles.eventBtn} primary`}
              onClick={onStartAllEvents}
            >
              Start All
            </button>
          )}
        </div>
      )}

      {/* Active Events */}
      {hasActive && (
        <div className={styles.group}>
          <div className={styles.label}>Active</div>
          <div className={styles.eventList}>
            {activeEvents.map(eventId => {
              const progress = eventProgress[eventId] || {};
              return (
                <div key={eventId} className={styles.activeEvent}>
                  <div className={styles.eventName}>{eventId}</div>
                  <div className={styles.progress}>
                    {progress.responded || 0}/{progress.total || 0}
                  </div>
                  <button
                    className={styles.resolveBtn}
                    onClick={() => onResolveEvent(eventId)}
                  >
                    Resolve
                  </button>
                </div>
              );
            })}
          </div>
          {activeEvents.length > 1 && (
            <button
              className={`${styles.eventBtn} success`}
              onClick={onResolveAllEvents}
            >
              Resolve All
            </button>
          )}
        </div>
      )}

      {!hasPending && !hasActive && !isDayPhase && (
        <div className={styles.empty}>No events available</div>
      )}
    </section>

    <CustomVoteModal
      isOpen={showCustomVoteModal}
      onClose={() => setShowCustomVoteModal(false)}
      onSubmit={handleCustomVoteSubmit}
      availableItems={availableItems}
      availableRoles={availableRoles}
    />
  </>
  );
}
