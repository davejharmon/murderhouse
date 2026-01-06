// client/src/components/EventPanel.jsx
import styles from './EventPanel.module.css';

export default function EventPanel({
  pendingEvents,
  activeEvents,
  eventProgress,
  onStartEvent,
  onStartAllEvents,
  onResolveEvent,
  onResolveAllEvents,
}) {
  const hasPending = pendingEvents.length > 0;
  const hasActive = activeEvents.length > 0;

  return (
    <section className={styles.panel}>
      <h2>Events</h2>

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

      {!hasPending && !hasActive && (
        <div className={styles.empty}>No events available</div>
      )}
    </section>
  );
}
