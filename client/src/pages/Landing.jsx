// client/src/pages/Landing.jsx
import { Link } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import styles from './Landing.module.css';

export default function Landing() {
  const { connected, gameState } = useGame();
  const players = gameState?.players || [];

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <header className={styles.header}>
          <h1>MURDERHOUSE</h1>
          <p className={styles.tagline}>A social deduction game</p>
        </header>

        <section className={styles.links}>
          <div className={styles.linkGroup}>
            <h2>Join as Player</h2>
            <div className={styles.playerGrid}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                const taken = players.some((p) => p.id === String(num));
                return (
                  <Link
                    key={num}
                    to={`/player/${num}`}
                    className={`${styles.playerLink} ${
                      taken ? styles.taken : ''
                    }`}
                  >
                    <span className={styles.playerNum}>{num}</span>
                    {taken && <span className={styles.takenLabel}>Joined</span>}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className={styles.linkGroup}>
            <h2>Controls</h2>
            <div className={styles.controlLinks}>
              <Link to='/host' className={styles.controlLink}>
                Host Dashboard
              </Link>
              <Link to='/screen' className={styles.controlLink}>
                Big Screen
              </Link>
              <Link to='/debug' className={styles.controlLink}>
                Debug Grid
              </Link>
              <Link to='/operator' className={styles.controlLink}>
                Operator
              </Link>
            </div>
          </div>
        </section>

        <footer className={styles.footer}>
          <div
            className={`${styles.status} ${connected ? styles.connected : ''}`}
          >
            {connected ? '● Connected' : '○ Connecting...'}
          </div>
        </footer>
      </div>
    </div>
  );
}
