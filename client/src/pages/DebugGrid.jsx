// client/src/pages/DebugGrid.jsx
import { useState, useEffect, useRef } from 'react';
import { ClientMsg, ServerMsg } from '@shared/constants.js';
import PlayerConsole from '../components/PlayerConsole';
import styles from './DebugGrid.module.css';
import { Link } from 'react-router-dom';

const PLAYER_COUNT = 9;
const WS_URL = import.meta.env.DEV
  ? `ws://${window.location.hostname}:8080`
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

const HEARTBEAT_TICK_MS = 1500;

function initSimState() {
  const base = 60 + Math.random() * 20; // resting BPM 60–80
  return { base, current: base, mode: 'normal', spikeTarget: 0, spikeTicks: 0 };
}

function tickSimState(s) {
  if (s.mode === 'normal') {
    if (Math.random() < 0.005) {
      // 0.5% chance per tick to spike above 110
      s.mode = 'spiking';
      s.spikeTarget = 112 + Math.random() * 20; // 112–132
      s.spikeTicks = 5 + Math.floor(Math.random() * 5); // 5–9 ticks
    } else {
      const drift = (s.base - s.current) * 0.15;
      s.current = Math.round(s.current + drift + (Math.random() * 6 - 3));
      s.current = Math.max(54, Math.min(100, s.current));
    }
  } else if (s.mode === 'spiking') {
    s.current = Math.round(s.current + (s.spikeTarget - s.current) * 0.5);
    s.spikeTicks--;
    if (s.spikeTicks <= 0) s.mode = 'recovering';
  } else if (s.mode === 'recovering') {
    s.current = Math.round(s.current + (s.base - s.current) * 0.15);
    if (Math.abs(s.current - s.base) < 3) {
      s.current = Math.round(s.base);
      s.mode = 'normal';
    }
  }
  return s;
}

export default function DebugGrid() {
  const [playerStates, setPlayerStates] = useState({});
  const [gameStates, setGameStates] = useState({});
  const [eventPrompts, setEventPrompts] = useState({});
  const [eventResults, setEventResults] = useState({});
  const [connections, setConnections] = useState({});
  const [fakeHeartbeats, setFakeHeartbeats] = useState(false);
  const wsRefs = useRef({});
  const simStateRef = useRef({});
  const gameStatesRef = useRef({});

  // Set page title
  useEffect(() => {
    document.title = 'Debug - MURDERHOUSE';
  }, []);

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
            gameStatesRef.current[playerId] = payload;
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

  // Fake heartbeat simulation
  useEffect(() => {
    if (!fakeHeartbeats) {
      // Clear heartbeats for all players
      for (let i = 1; i <= PLAYER_COUNT; i++) {
        const ws = wsRefs.current[String(i)];
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: ClientMsg.HEARTBEAT, payload: { bpm: 0 } }));
        }
      }
      return;
    }

    // Initialise sim state for any players that don't have one yet
    for (let i = 1; i <= PLAYER_COUNT; i++) {
      const id = String(i);
      if (!simStateRef.current[id]) simStateRef.current[id] = initSimState();
    }

    const timer = setInterval(() => {
      for (let i = 1; i <= PLAYER_COUNT; i++) {
        const id = String(i);
        const ws = wsRefs.current[id];
        if (!ws || ws.readyState !== WebSocket.OPEN) continue;

        // If a real (non-fake) terminal is sending heartbeats for this player, step aside
        const liveHeartbeat = gameStatesRef.current[id]?.players?.find(p => p.id === id)?.heartbeat;
        if (liveHeartbeat?.active && !liveHeartbeat?.fake) continue;

        const s = simStateRef.current[id] ?? initSimState();
        simStateRef.current[id] = tickSimState(s);
        ws.send(JSON.stringify({ type: ClientMsg.HEARTBEAT, payload: { bpm: s.current, fake: true } }));
      }
    }, HEARTBEAT_TICK_MS);

    return () => clearInterval(timer);
  }, [fakeHeartbeats]);

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
    onIdleScrollUp: () => send(playerId, ClientMsg.IDLE_SCROLL_UP),
    onIdleScrollDown: () => send(playerId, ClientMsg.IDLE_SCROLL_DOWN),
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>DEBUG: 9-Player Grid</h1>
        <Link to='/host' className={styles.controlLink}>
          Host
        </Link>
        <Link to='/screen' className={styles.controlLink}>
          Screen
        </Link>
        <Link to='/operator' className={styles.controlLink}>
          Operator
        </Link>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={fakeHeartbeats}
            onChange={(e) => setFakeHeartbeats(e.target.checked)}
          />
          Fake Heartbeats
        </label>
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
