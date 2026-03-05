// client/src/components/GameLog.jsx
import { useRef, useEffect, useState } from 'react';
import styles from './GameLog.module.css';

export default function GameLog({ entries = [], autoScroll = true }) {
  const bottomRef = useRef(null);
  const [trimmedAt, setTrimmedAt] = useState(0);

  // Auto-scroll to bottom on new entries (skip when panel is off-screen)
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries.length, autoScroll]);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const visible = entries.slice(Math.max(trimmedAt, entries.length - 200));

  return (
    <div className={styles.log}>
      <header className={styles.header}>
        <h2>Log</h2>
        {entries.length > 10 && (
          <button
            className={styles.clearBtn}
            onClick={() => setTrimmedAt(Math.max(trimmedAt, entries.length - 10))}
            title='Keep last 10 entries'
          >
            Clear
          </button>
        )}
      </header>

      <div className={styles.entries}>
        {visible.length === 0 ? (
          <div className={styles.empty}>No events yet</div>
        ) : (
          visible.map((entry, i) => (
            <div key={i} className={styles.entry}>
              <span className={styles.time}>{formatTime(entry.timestamp)}</span>
              <span className={styles.message}>{entry.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
