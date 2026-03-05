// client/src/pages/Landing.jsx
import { Link } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { getStr } from '../strings/index.js';
import styles from './Landing.module.css';

export default function Landing() {
  const { connected, gameState } = useGame();
  const players = gameState?.players || [];

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <header className={styles.header}>
          <h1>{getStr('landing', 'title')}</h1>
          <p className={styles.tagline}>{getStr('landing', 'tagline')}</p>
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
                    {taken && <span className={styles.takenLabel}>{getStr('landing', 'joined')}</span>}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className={styles.linkGroup}>
            <h2>Controls</h2>
            <div className={styles.controlLinks}>
              <Link to='/host' className={styles.controlLink}>
                Host
              </Link>
              <Link to='/screen' className={styles.controlLink}>
                Screen
              </Link>
              <Link to='/debug' className={styles.controlLink}>
                Debug Grid
              </Link>
              <Link to='/operator' className={styles.controlLink}>
                Operator
              </Link>
            </div>
          </div>

          <div className={styles.linkGroup}>
            <h2>Tools</h2>
            <div className={styles.controlLinks}>
              <Link to='/slides' className={styles.controlLink}>
                Slide Editor
              </Link>
              <Link to='/strings' className={styles.controlLink}>
                String Sheets
              </Link>
            </div>
          </div>
        </section>

        <footer className={styles.footer}>
          <div
            className={`${styles.status} ${connected ? styles.connected : ''}`}
          >
            {connected ? getStr('landing', 'connected') : getStr('landing', 'connecting')}
          </div>
        </footer>
      </div>
    </div>
  );
}
