// client/src/components/PlayerGrid.jsx
import { PlayerStatus } from '@shared/constants.js';
import styles from './PlayerGrid.module.css';

export default function PlayerGrid({
  players,
  eventParticipants,
  eventProgress,
  isLobby,
  onKill,
  onRevive,
  onKick,
}) {
  // Get which events a player is participating in
  const getPlayerEvents = (playerId) => {
    const events = [];
    for (const [eventId, participants] of Object.entries(eventParticipants)) {
      if (participants.includes(playerId)) {
        events.push(eventId);
      }
    }
    return events;
  };

  if (players.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyText}>WAITING FOR PLAYERS</div>
        <div className={styles.emptySubtext}>Players can join at /player/1 through /player/9</div>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {players.map((player) => {
        const isAlive = player.status === PlayerStatus.ALIVE;
        const events = getPlayerEvents(player.id);
        const isActive = events.length > 0;

        return (
          <div 
            key={player.id}
            className={`${styles.card} ${!isAlive ? styles.dead : ''} ${isActive ? styles.active : ''}`}
          >
            {/* Portrait */}
            <div className={styles.portrait}>
              <img 
                src={`/images/players/${player.portrait}`}
                alt={player.name}
                className={styles.portraitImage}
              />
              {!player.connected && (
                <div className={styles.disconnected}>●</div>
              )}
            </div>

            {/* Info */}
            <div className={styles.info}>
              <div className={styles.seat}>#{player.seatNumber}</div>
              <div className={styles.name}>{player.name}</div>
              {player.role && (
                <div 
                  className={styles.role}
                  style={{ color: player.roleColor }}
                >
                  {player.roleName}
                </div>
              )}
            </div>

            {/* Event indicators */}
            {events.length > 0 && (
              <div className={styles.events}>
                {events.map(eventId => (
                  <span key={eventId} className={styles.eventBadge}>
                    {eventId}
                  </span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className={styles.actions}>
              {isLobby ? (
                <button 
                  className={styles.actionBtn}
                  onClick={() => onKick(player.id)}
                  title="Kick player"
                >
                  ✕
                </button>
              ) : (
                <>
                  {isAlive ? (
                    <button 
                      className={`${styles.actionBtn} ${styles.kill}`}
                      onClick={() => onKill(player.id)}
                      title="Kill player"
                    >
                      💀
                    </button>
                  ) : (
                    <button 
                      className={`${styles.actionBtn} ${styles.revive}`}
                      onClick={() => onRevive(player.id)}
                      title="Revive player"
                    >
                      ↺
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Status overlay for dead players */}
            {!isAlive && (
              <div className={styles.deadOverlay}>
                <span>DEAD</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
