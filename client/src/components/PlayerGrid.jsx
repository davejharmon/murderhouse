// client/src/components/PlayerGrid.jsx
import { useState } from 'react';
import {
  PlayerStatus,
  DEBUG_MODE,
  AVAILABLE_ITEMS,
} from '@shared/constants.js';
import PortraitSelectorModal from './PortraitSelectorModal';
import styles from './PlayerGrid.module.css';

export default function PlayerGrid({
  players,
  eventParticipants,
  eventProgress,
  isLobby,
  onKill,
  onRevive,
  onKick,
  onGiveItem,
  onRemoveItem,
  onDebugAutoSelect,
  onSetName,
  onSetPortrait,
}) {
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editedName, setEditedName] = useState('');
  const [portraitModalPlayer, setPortraitModalPlayer] = useState(null);

  // Handle name edit start
  const handleNameClick = (player) => {
    if (onSetName) {
      setEditingPlayerId(player.id);
      setEditedName(player.name);
    }
  };

  // Handle name edit save
  const handleNameSave = (playerId) => {
    if (
      editedName.trim() &&
      editedName !== players.find((p) => p.id === playerId)?.name
    ) {
      onSetName(playerId, editedName.trim());
    }
    setEditingPlayerId(null);
    setEditedName('');
  };

  // Handle name edit cancel
  const handleNameCancel = () => {
    setEditingPlayerId(null);
    setEditedName('');
  };

  // Handle portrait selection
  const handlePortraitSelect = (portrait) => {
    if (portraitModalPlayer && onSetPortrait) {
      onSetPortrait(portraitModalPlayer.id, portrait);
    }
  };

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

  // Compute who is targeting each player
  const getTargeters = (targetId) => {
    const targeters = [];
    for (const player of players) {
      // Check if this player is targeting the target (either hovering or confirmed)
      const isHovering = player.currentSelection === targetId;
      const isConfirmed = player.confirmedSelection === targetId;

      if (isHovering || isConfirmed) {
        targeters.push({
          playerId: player.id,
          seatNumber: player.seatNumber,
          roleColor: player.roleColor || '#888',
          confirmed: isConfirmed,
        });
      }
    }
    // Sort by seat number for consistent display
    return targeters.sort((a, b) => a.seatNumber - b.seatNumber);
  };

  if (players.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyText}>WAITING FOR PLAYERS</div>
        <div className={styles.emptySubtext}>
          Players can join at /player/1 through /player/9
        </div>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {players.map((player) => {
        const isAlive = player.status === PlayerStatus.ALIVE;
        const events = getPlayerEvents(player.id);
        const isActive = events.length > 0;
        const hasUncommittedSelection =
          isActive && !player.confirmedSelection && !player.abstained;

        const targeters = getTargeters(player.id);

        return (
          <div
            key={player.id}
            className={`${styles.card} ${!isAlive ? styles.dead : ''} ${
              isActive ? styles.active : ''
            }`}
          >
            {/* Portrait */}
            <div
              className={`${styles.portrait} ${
                onSetPortrait ? styles.clickable : ''
              }`}
              onClick={() => onSetPortrait && setPortraitModalPlayer(player)}
              title={onSetPortrait ? 'Click to change portrait' : undefined}
            >
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
              {editingPlayerId === player.id ? (
                <input
                  type='text'
                  className={styles.nameInput}
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onBlur={() => handleNameSave(player.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleNameSave(player.id);
                    if (e.key === 'Escape') handleNameCancel();
                  }}
                  autoFocus
                  maxLength={20}
                />
              ) : (
                <div
                  className={`${styles.name} ${
                    onSetName ? styles.editable : ''
                  }`}
                  onClick={() => handleNameClick(player)}
                  title={onSetName ? 'Click to edit name' : undefined}
                >
                  {player.name}
                </div>
              )}
              {player.role && (
                <div
                  className={styles.role}
                  style={{ color: player.roleColor }}
                >
                  {player.roleName}
                </div>
              )}

              {/* Inventory */}
              {player.inventory && player.inventory.length > 0 && (
                <div className={styles.inventory}>
                  {player.inventory.map((item, idx) => (
                    <div key={idx} className={styles.inventoryItem}>
                      <span className={styles.itemName}>
                        {item.id} ({item.uses}/{item.maxUses})
                      </span>
                      {onRemoveItem && (
                        <button
                          className={styles.removeItemBtn}
                          onClick={() => onRemoveItem(player.id, item.id)}
                          title='Remove item'
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Event indicators */}
            {events.length > 0 && (
              <div className={styles.events}>
                {events.map((eventId) => (
                  <span key={eventId} className={styles.eventBadge}>
                    {eventId}
                  </span>
                ))}
              </div>
            )}

            {/* Targeting pips - shows who is targeting this player */}
            {targeters.length > 0 && (
              <div className={styles.targetingPips}>
                {targeters.map(
                  ({ playerId, seatNumber, roleColor, confirmed }) => (
                    <div
                      key={playerId}
                      className={`${styles.targetPip} ${
                        confirmed ? styles.confirmed : styles.hovering
                      }`}
                      style={{ backgroundColor: roleColor }}
                      title={`Player #${seatNumber} ${
                        confirmed ? '(confirmed)' : '(selecting)'
                      }`}
                    >
                      {seatNumber}
                    </div>
                  )
                )}
              </div>
            )}

            {/* Actions */}
            <div className={styles.actions}>
              {isLobby ? (
                <button
                  className={styles.actionBtn}
                  onClick={() => onKick(player.id)}
                  title='Kick player'
                >
                  ✕
                </button>
              ) : (
                <>
                  {isAlive ? (
                    <button
                      className={`${styles.actionBtn} ${styles.kill}`}
                      onClick={() => onKill(player.id)}
                      title='Kill player'
                    >
                      💀
                    </button>
                  ) : (
                    <button
                      className={`${styles.actionBtn} ${styles.revive}`}
                      onClick={() => onRevive(player.id)}
                      title='Revive player'
                    >
                      ↺
                    </button>
                  )}

                  {/* Debug Auto-Select Button */}
                  {DEBUG_MODE &&
                    hasUncommittedSelection &&
                    onDebugAutoSelect && (
                      <button
                        className={`${styles.actionBtn} ${styles.debug}`}
                        onClick={() => onDebugAutoSelect(player.id)}
                        title='Debug: Auto-select random target'
                      >
                        🎲
                      </button>
                    )}

                  {/* Give Item Dropdown */}
                  {onGiveItem && (
                    <select
                      className={styles.itemSelect}
                      onChange={(e) => {
                        if (e.target.value) {
                          onGiveItem(player.id, e.target.value);
                          e.target.value = '';
                        }
                      }}
                      defaultValue=''
                      title='Give item'
                    >
                      <option value='' disabled>
                        + Item
                      </option>
                      {AVAILABLE_ITEMS.map((itemId) => (
                        <option key={itemId} value={itemId}>
                          {itemId}
                        </option>
                      ))}
                    </select>
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

      {/* Portrait Selector Modal */}
      {portraitModalPlayer && (
        <PortraitSelectorModal
          isOpen={!!portraitModalPlayer}
          onClose={() => setPortraitModalPlayer(null)}
          onSelect={handlePortraitSelect}
          currentPortrait={portraitModalPlayer.portrait}
          playerName={portraitModalPlayer.name}
        />
      )}
    </div>
  );
}
