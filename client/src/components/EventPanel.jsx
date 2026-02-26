// client/src/components/EventPanel.jsx
import { useState } from 'react';
import { DEBUG_MODE, AVAILABLE_ITEMS } from '@shared/constants.js';
import CustomEventModal from './CustomEventModal';
import styles from './EventPanel.module.css';

export default function EventPanel({
  pendingEvents,
  activeEvents,
  eventProgress,
  eventMetadata,
  currentPhase,
  onStartEvent,
  onStartAllEvents,
  onResolveEvent,
  onResolveAllEvents,
  onSkipEvent,
  onDebugAutoSelectAll,
  onCreateCustomEvent,
  onResetEvent,
  onStartEventTimer,
  timerDuration,
}) {
  const [showCustomEventModal, setShowCustomEventModal] = useState(false);

  const hasPending = pendingEvents.length > 0;
  const hasActive = activeEvents.length > 0;
  const isDayPhase = currentPhase === 'day';

  // Convert AVAILABLE_ITEMS to object format for UI
  const availableItems = AVAILABLE_ITEMS.map((id) => ({
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1).replace(/([A-Z])/g, ' $1'), // camelCase to Title Case
  }));

  const availableRoles = [
    { id: 'villager', name: 'Villager' },
    { id: 'werewolf', name: 'Werewolf' },
    { id: 'roleblocker', name: 'Roleblocker' },
    { id: 'seer', name: 'Seer' },
    { id: 'doctor', name: 'Doctor' },
    { id: 'hunter', name: 'Hunter' },
  ];

  const handleCustomEventSubmit = (config) => {
    onCreateCustomEvent(config);
    setShowCustomEventModal(false);
  };

  return (
    <>
      <section className={styles.panel}>
        <h2>Events</h2>

        {/* Create Event Button - Only during DAY phase */}
        {isDayPhase && (
          <div className={styles.group}>
            <button
              className={`${styles.eventBtn} ${styles.customEvent}`}
              onClick={() => setShowCustomEventModal(true)}
            >
              Create Event
            </button>
          </div>
        )}

        {/* Pending Events */}
        {hasPending && (
          <div className={styles.group}>
            <div className={styles.label}>Pending</div>
            <div className={styles.eventList}>
              {pendingEvents.map((eventId) => (
                <button
                  key={eventId}
                  className={styles.eventBtn}
                  onClick={() => onStartEvent(eventId)}
                >
                  Start {eventId === 'customEvent' ? 'Custom' : eventId}
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
              {activeEvents.map((eventId) => {
                const progress = eventProgress[eventId] || {};
                const metadata = eventMetadata[eventId] || {};
                const isPlayerResolved = metadata.playerResolved || false;
                const hasUncommitted =
                  (progress.total || 0) > (progress.responded || 0);

                return (
                  <div key={eventId} className={styles.activeEvent}>
                    <div className={styles.eventName}>
                      {eventId === 'customEvent' ? 'Custom' : eventId}
                    </div>
                    <div className={styles.progress}>
                      {progress.responded || 0}/{progress.total || 0}
                    </div>
                    <div className={styles.eventActions}>
                      {DEBUG_MODE && hasUncommitted && onDebugAutoSelectAll && (
                        <button
                          className={`${styles.debugBtn}`}
                          onClick={() => onDebugAutoSelectAll(eventId)}
                          title='Debug: Auto-select all remaining players'
                        >
                          🎲
                        </button>
                      )}
                      {isPlayerResolved ? (
                        <button
                          className={`${styles.debugBtn} ${styles.skipBtn}`}
                          onClick={() => onSkipEvent(eventId)}
                        >
                          ❌
                        </button>
                      ) : (
                        <>
                          <button
                            className={`${styles.debugBtn} ${styles.skipBtn}`}
                            onClick={() => onResetEvent(eventId)}
                            title='Reset event to pending'
                          >
                            ❌
                          </button>
                          <button
                            className={styles.debugBtn}
                            onClick={() => onResolveEvent(eventId)}
                          >
                            ✔️
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {onStartEventTimer && (
              <button
                className={styles.eventBtn}
                onClick={onStartEventTimer}
                title={`Start ${timerDuration}s countdown`}
              >
                ⏱ {timerDuration}s
              </button>
            )}
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

      <CustomEventModal
        isOpen={showCustomEventModal}
        onClose={() => setShowCustomEventModal(false)}
        onSubmit={handleCustomEventSubmit}
        availableItems={availableItems}
        availableRoles={availableRoles}
      />
    </>
  );
}
