// client/src/components/slides/VoteTallySlide.jsx
import { fitFontSize } from './slideUtils.js'
import styles from '../../pages/Screen.module.css'

export default function VoteTallySlide({ slide, players }) {
  const { tally, voters, frontrunners, anonymousVoting, title, subtitle } = slide

  const getPlayer = (id) => players?.find(p => p.id === id)

  const sorted = Object.entries(tally || {})
    .map(([id, count]) => ({
      player: getPlayer(id),
      count,
      voterIds: voters?.[id] || [],
      isFrontrunner: frontrunners?.includes(id) || frontrunners?.includes(Number(id)) || false,
    }))
    .filter((entry) => entry.player)
    .sort((a, b) => b.count - a.count)

  return (
    <div key={slide.id} className={styles.slide}>
      <h1 className={styles.title} style={{ fontSize: fitFontSize(title || 'VOTES') }}>{title || 'VOTES'}</h1>
      <div className={styles.tallyList}>
        {sorted.map(({ player, count, voterIds, isFrontrunner }) => (
          <div
            key={player.id}
            className={`${styles.tallyRow} ${isFrontrunner ? styles.tallyRowFrontrunner : ''}`}
          >
            <img
              src={`/images/players/${player.portrait}`}
              alt={player.name}
              className={styles.tallyPortrait}
            />
            <span className={styles.tallyName}>{player.name}</span>
            {anonymousVoting ? (
              <span className={styles.tallyCount}>{count}</span>
            ) : (
              <div className={styles.tallyVoters}>
                {voterIds.map((voterId) => {
                  const voter = getPlayer(voterId)
                  return voter ? (
                    <img
                      key={voterId}
                      src={`/images/players/${voter.portrait}`}
                      alt={voter.name}
                      title={voter.name}
                      className={styles.tallyVoterPortrait}
                    />
                  ) : null
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
  )
}
