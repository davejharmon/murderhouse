// client/src/components/PlayerGrid.jsx
import { useState, memo, useMemo, useCallback } from 'react';
import {
  PlayerStatus,
  DEBUG_MODE,
  AVAILABLE_ITEMS,
  AVAILABLE_ROLES,
} from '@shared/constants.js';
import PortraitSelectorModal from './PortraitSelectorModal';
import styles from './PlayerGrid.module.css';

// Generate a stable key representing card state for comparison
function getCardStateKey(props) {
  const {
    player,
    isAlive,
    isActive,
    hasUncommittedSelection,
    isLobby,
    isEditing,
    editedName,
    events,
    targeters,
  } = props;

  // Build a string key from all data that affects rendering
  const invKey = (player.inventory || [])
    .map((i) => `${i.id}:${i.uses}`)
    .join(',');
  const eventsKey = events.join(',');
  const targetersKey = targeters
    .map((t) => `${t.odId}:${t.confirmed}`)
    .join(',');

  return [
    player.id,
    player.name,
    player.portrait,
    player.seatNumber,
    player.connected,
    player.terminalConnected,
    player.role,
    player.roleName,
    player.roleColor,
    player.preAssignedRole,
    isAlive,
    isActive,
    hasUncommittedSelection,
    isLobby,
    isEditing,
    isEditing ? editedName : '', // Only include editedName when editing this card
    invKey,
    eventsKey,
    targetersKey,
  ].join('|');
}

function playerCardPropsAreEqual(prevProps, nextProps) {
  return getCardStateKey(prevProps) === getCardStateKey(nextProps);
}

// Memoized player card to prevent re-renders when other players change
const PlayerCard = memo(function PlayerCard({
  player,
  isAlive,
  isActive,
  hasUncommittedSelection,
  events,
  targeters,
  isLobby,
  isEditing,
  editedName,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel,
  onPortraitClick,
  canEditName,
  canEditPortrait,
  onKill,
  onRevive,
  onKick,
  onGiveItem,
  onRemoveItem,
  onPreAssignRole,
  onDebugAutoSelect,
}) {
  return (
    <div
      className={`${styles.card} ${!isAlive ? styles.dead : ''} ${
        isActive ? styles.active : ''
      }`}
    >
      {/* Portrait */}
      <div
        className={`${styles.portrait} ${
          canEditPortrait ? styles.clickable : ''
        }`}
        onClick={() => canEditPortrait && onPortraitClick(player)}
        title={canEditPortrait ? 'Click to change portrait' : undefined}
      >
        <img
          src={`/images/players/${player.portrait}`}
          alt={player.name}
          className={styles.portraitImage}
        />
        {!player.connected && <div className={styles.disconnected}>●</div>}
        {player.terminalConnected && <div className={styles.terminal}>▣</div>}
      </div>

      {/* Info */}
      <div className={styles.info}>
        <div className={styles.seat}>#{player.seatNumber}</div>
        {isEditing ? (
          <input
            type='text'
            className={styles.nameInput}
            value={editedName}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={() => onEditSave(player.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onEditSave(player.id);
              if (e.key === 'Escape') onEditCancel();
            }}
            autoFocus
            maxLength={20}
          />
        ) : (
          <div
            className={`${styles.name} ${canEditName ? styles.editable : ''}`}
            onClick={() => canEditName && onEditStart(player)}
            title={canEditName ? 'Click to edit name' : undefined}
          >
            {player.name}
          </div>
        )}
        {player.role && (
          <div className={styles.role} style={{ color: player.roleColor }}>
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
      <div className={styles.targetingPips}>
        {targeters.map(({ odId, seatNumber, roleColor, confirmed }) => (
          <div
            key={odId}
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
        ))}
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        {isLobby ? (
          <>
            {/* Role Pre-Assignment Dropdown */}
            {onPreAssignRole && (
              <select
                className={styles.roleSelect}
                value={player.preAssignedRole || ''}
                onChange={(e) => onPreAssignRole(player.id, e.target.value)}
                title='Pre-assign role'
              >
                <option value=''>Random</option>
                {AVAILABLE_ROLES.map((roleId) => (
                  <option key={roleId} value={roleId}>
                    {roleId}
                  </option>
                ))}
              </select>
            )}
            <button
              className={styles.actionBtn}
              onClick={() => onKick(player.id)}
              title='Kick player'
            >
              ✕
            </button>
          </>
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
            {DEBUG_MODE && hasUncommittedSelection && onDebugAutoSelect && (
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
},
playerCardPropsAreEqual);

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
  onPreAssignRole,
  onDebugAutoSelect,
  onSetName,
  onSetPortrait,
}) {
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editedName, setEditedName] = useState('');
  const [portraitModalPlayer, setPortraitModalPlayer] = useState(null);

  // Memoize event participation lookup
  const playerEvents = useMemo(() => {
    const eventsMap = {};
    for (const player of players) {
      const events = [];
      for (const [eventId, participants] of Object.entries(eventParticipants)) {
        if (participants.includes(player.id)) {
          events.push(eventId);
        }
      }
      eventsMap[player.id] = events;
    }
    return eventsMap;
  }, [players, eventParticipants]);

  // Memoize targeting data for all players
  const allTargeters = useMemo(() => {
    const targetersMap = {};
    for (const player of players) {
      targetersMap[player.id] = [];
    }
    for (const player of players) {
      const targetId = player.confirmedSelection || player.currentSelection;
      if (targetId && targetersMap[targetId]) {
        targetersMap[targetId].push({
          odId: player.id,
          seatNumber: player.seatNumber,
          roleColor: player.roleColor || '#888',
          confirmed: !!player.confirmedSelection,
        });
      }
    }
    // Sort each by seat number
    for (const id of Object.keys(targetersMap)) {
      targetersMap[id].sort((a, b) => a.seatNumber - b.seatNumber);
    }
    return targetersMap;
  }, [players]);

  // Stable callbacks
  const handleNameClick = useCallback(
    (player) => {
      if (onSetName) {
        setEditingPlayerId(player.id);
        setEditedName(player.name);
      }
    },
    [onSetName]
  );

  const handleNameSave = useCallback(
    (playerId) => {
      const player = players.find((p) => p.id === playerId);
      if (editedName.trim() && editedName !== player?.name) {
        onSetName(playerId, editedName.trim());
      }
      setEditingPlayerId(null);
      setEditedName('');
    },
    [editedName, players, onSetName]
  );

  const handleNameCancel = useCallback(() => {
    setEditingPlayerId(null);
    setEditedName('');
  }, []);

  const handlePortraitSelect = useCallback(
    (portrait) => {
      if (portraitModalPlayer && onSetPortrait) {
        onSetPortrait(portraitModalPlayer.id, portrait);
      }
    },
    [portraitModalPlayer, onSetPortrait]
  );

  const handleEditChange = useCallback((value) => {
    setEditedName(value);
  }, []);

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
        const events = playerEvents[player.id] || [];
        const isActive = events.length > 0;
        const hasUncommittedSelection =
          isActive && !player.confirmedSelection && !player.abstained;
        const targeters = allTargeters[player.id] || [];

        return (
          <PlayerCard
            key={player.id}
            player={player}
            isAlive={isAlive}
            isActive={isActive}
            hasUncommittedSelection={hasUncommittedSelection}
            events={events}
            targeters={targeters}
            isLobby={isLobby}
            isEditing={editingPlayerId === player.id}
            editedName={editedName}
            onEditStart={handleNameClick}
            onEditChange={handleEditChange}
            onEditSave={handleNameSave}
            onEditCancel={handleNameCancel}
            onPortraitClick={setPortraitModalPlayer}
            canEditName={!!onSetName}
            canEditPortrait={!!onSetPortrait}
            onKill={onKill}
            onRevive={onRevive}
            onKick={onKick}
            onGiveItem={onGiveItem}
            onRemoveItem={onRemoveItem}
            onPreAssignRole={onPreAssignRole}
            onDebugAutoSelect={onDebugAutoSelect}
          />
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
