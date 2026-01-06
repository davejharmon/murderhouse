// client/src/components/GameLog.jsx
import { useRef, useEffect } from 'react';
import styles from './GameLog.module.css';

export default function GameLog({ entries = [] }) {
  const bottomRef = useRef(null);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={styles.log}>
      <header className={styles.header}>
        <h2>Log</h2>
      </header>

      <div className={styles.entries}>
        {entries.length === 0 ? (
          <div className={styles.empty}>No events yet</div>
        ) : (
          entries.map((entry, i) => (
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
