// client/src/pages/DebugGrid.jsx
import { useState, useEffect, useRef } from 'react';
import { ClientMsg, ServerMsg } from '@shared/constants.js';
import PlayerConsole from '../components/PlayerConsole';
import styles from './DebugGrid.module.css';
import { Link } from 'react-router-dom';

const PLAYER_COUNT = 9;
const WS_URL = import.meta.env.DEV
  ? `ws://${window.location.hostname}:8080`
  : `ws://${window.location.host}`;

export default function DebugGrid() {
  const [playerStates, setPlayerStates] = useState({});
  const [gameStates, setGameStates] = useState({});
  const [eventPrompts, setEventPrompts] = useState({});
  const [eventResults, setEventResults] = useState({});
  const [connections, setConnections] = useState({});
  const wsRefs = useRef({});

  // Connect all 9 players
  useEffect(() => {
    const newConnections = {};

    for (let i = 1; i <= PLAYER_COUNT; i++) {
      const playerId = String(i);
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log(`[Player ${playerId}] Connected`);
        ws.send(
          JSON.stringify({
            type: ClientMsg.JOIN,
            payload: { playerId },
          })
        );
        newConnections[playerId] = true;
        setConnections({ ...newConnections });
      };

      ws.onmessage = (event) => {
        const { type, payload } = JSON.parse(event.data);

        switch (type) {
          case ServerMsg.WELCOME:
            console.log(`[Player ${playerId}] Welcomed`);
            break;

          case ServerMsg.GAME_STATE:
            setGameStates((prev) => ({ ...prev, [playerId]: payload }));

            // Auto-rejoin if game was reset (in lobby and player not in player list)
            if (payload.phase === 'lobby' && payload.players) {
              const playerExists = payload.players.some(p => p.id === playerId);
              if (!playerExists && ws.readyState === WebSocket.OPEN) {
                console.log(`[Player ${playerId}] Auto-rejoining after reset`);
                ws.send(JSON.stringify({
                  type: ClientMsg.JOIN,
                  payload: { playerId }
                }));
              }
            }
            break;

          case ServerMsg.PLAYER_STATE:
            setPlayerStates((prev) => ({ ...prev, [playerId]: payload }));
            // Clear event prompt if no pending events
            if (payload.pendingEvents && payload.pendingEvents.length === 0) {
              setEventPrompts((prev) => ({ ...prev, [playerId]: null }));
            }
            break;

          case ServerMsg.EVENT_PROMPT:
            setEventPrompts((prev) => ({ ...prev, [playerId]: payload }));
            setEventResults((prev) => ({ ...prev, [playerId]: null })); // Clear previous results
            break;

          case ServerMsg.EVENT_RESULT:
            setEventResults((prev) => ({ ...prev, [playerId]: payload }));
            setEventPrompts((prev) => ({ ...prev, [playerId]: null }));
            break;

          case ServerMsg.ERROR:
            console.error(`[Player ${playerId}] Error:`, payload.message);
            break;

          default:
            break;
        }
      };

      ws.onclose = () => {
        console.log(`[Player ${playerId}] Disconnected`);
        newConnections[playerId] = false;
        setConnections({ ...newConnections });
      };

      ws.onerror = (error) => {
        console.error(`[Player ${playerId}] Error:`, error);
      };

      wsRefs.current[playerId] = ws;
    }

    // Cleanup on unmount
    return () => {
      Object.values(wsRefs.current).forEach((ws) => ws.close());
    };
  }, []);

  // Send message for a specific player
  const send = (playerId, type, payload = {}) => {
    const ws = wsRefs.current[playerId];
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  };

  // Handlers for each player
  const createHandlers = (playerId) => ({
    onSwipeUp: () => send(playerId, ClientMsg.SELECT_UP),
    onSwipeDown: () => send(playerId, ClientMsg.SELECT_DOWN),
    onConfirm: () => send(playerId, ClientMsg.CONFIRM),
    onAbstain: () => send(playerId, ClientMsg.ABSTAIN),
    onUseItem: (itemId) => send(playerId, ClientMsg.USE_ITEM, { itemId }),
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>DEBUG: 9-Player Grid</h1>
        <Link to='/host' className={styles.controlLink}>
          Host Dashboard
        </Link>
        <div className={styles.info}>
          Connected: {Object.values(connections).filter(Boolean).length}/
          {PLAYER_COUNT}
        </div>
      </div>

      <div className={styles.grid}>
        {Array.from({ length: PLAYER_COUNT }, (_, i) => {
          const playerId = String(i + 1);
          const playerState = playerStates[playerId];
          const gameState = gameStates[playerId];
          const eventPrompt = eventPrompts[playerId];
          const connected = connections[playerId];
          const handlers = createHandlers(playerId);

          // Determine selected and confirmed targets
          const selectedTarget = eventPrompt?.targets?.find(
            (t) => t.id === playerState?.currentSelection
          );
          const confirmedTarget = eventPrompt?.targets?.find(
            (t) => t.id === playerState?.confirmedSelection
          );

          const hasActiveEvent = (playerState?.pendingEvents?.length || 0) > 0;

          return (
            <div key={playerId} className={styles.playerCell}>
              {playerState ? (
                <PlayerConsole
                  player={playerState}
                  gameState={gameState}
                  eventPrompt={eventPrompt}
                  eventResult={eventResults[playerId]}
                  selectedTarget={selectedTarget}
                  confirmedTarget={confirmedTarget}
                  abstained={playerState.abstained}
                  hasActiveEvent={hasActiveEvent}
                  compact={true}
                  {...handlers}
                />
              ) : (
                <div className={styles.loading}>Connecting...</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
