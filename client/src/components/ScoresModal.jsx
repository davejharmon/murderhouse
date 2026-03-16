// client/src/components/ScoresModal.jsx
import Modal from './Modal';
import { getStr } from '../strings/index.js';
import styles from './ScoresModal.module.css';

export default function ScoresModal({
  isOpen,
  onClose,
  players = [],
  scores = {},
  onSetScore,
  scoringConfig = { survived: 1, winningTeam: 1, bestInvestigator: 2 },
  onScoringConfigChange,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="SCORES">
      <div className={styles.sections}>

        <section className={styles.section}>
          <h3>Scoring Rules</h3>
          {[
            { key: 'survived', label: getStr('host', 'scoring.survived') },
            { key: 'winningTeam', label: getStr('host', 'scoring.winningTeam') },
            { key: 'bestInvestigator', label: getStr('host', 'scoring.bestInvestigator') },
          ].map(({ key, label }) => (
            <div key={key} className={styles.scoringRow}>
              <span className={styles.scoringLabel}>{label}</span>
              <input
                type="number"
                min="0"
                max="99"
                value={scoringConfig[key] ?? 0}
                onChange={(e) => onScoringConfigChange({ ...scoringConfig, [key]: parseInt(e.target.value) || 0 })}
                className={styles.scoringInput}
              />
              <span className={styles.unit}>pts</span>
            </div>
          ))}
        </section>

        <section className={styles.section}>
          <h3>Player Scores</h3>
          {players.length === 0 ? (
            <div className={styles.empty}>No players connected</div>
          ) : (
            <div className={styles.scoreList}>
              {players.map(p => {
                const score = scores[p.name] ?? 0;
                return (
                  <div key={p.id} className={styles.scoreRow}>
                    <span className={styles.scoreName}>{p.name || `P${p.id}`}</span>
                    <button
                      className={styles.scoreBtn}
                      onClick={() => onSetScore(p.name, score - 1)}
                      disabled={!p.name}
                    >−</button>
                    <span className={styles.scoreValue}>{score}</span>
                    <button
                      className={styles.scoreBtn}
                      onClick={() => onSetScore(p.name, score + 1)}
                      disabled={!p.name}
                    >+</button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </Modal>
  );
}
