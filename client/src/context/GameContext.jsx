// client/src/context/GameContext.jsx
// Central state management via WebSocket

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { ServerMsg, ClientMsg } from '@shared/constants.js';

const GameContext = createContext(null);

const WS_URL = import.meta.env.DEV
  ? `ws://${window.location.hostname}:8080`
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

export function GameProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [playerState, setPlayerState] = useState(null);
  const [slideQueue, setSlideQueue] = useState({ queue: [], currentIndex: -1, current: null });
  const [currentSlide, setCurrentSlide] = useState(null);
  const [log, setLog] = useState([]);
  const [eventPrompt, setEventPrompt] = useState(null);
  const [eventResult, setEventResult] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [eventTimers, setEventTimers] = useState({});

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      setConnected(true);
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      setConnected(false);
      // Attempt reconnect
      reconnectTimeoutRef.current = setTimeout(connect, 2000);
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
    };

    ws.onmessage = (event) => {
      try {
        const { type, payload } = JSON.parse(event.data);
        handleMessage(type, payload);
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };
  }, []);

  // Handle incoming messages
  const handleMessage = useCallback((type, payload) => {
    switch (type) {
      case ServerMsg.WELCOME:
        console.log('[WS] Welcome:', payload);
        break;

      case ServerMsg.ERROR:
        console.error('[WS] Error:', payload.message);
        addNotification(payload.message, 'error');
        break;

      case ServerMsg.GAME_STATE:
        setGameState(payload);
        break;

      case ServerMsg.PLAYER_STATE:
        setPlayerState(payload);
        // Clear event prompt if its event is no longer in pendingEvents
        setEventPrompt(prev => {
          if (!prev) return null;
          if (!payload?.pendingEvents || !payload.pendingEvents.includes(prev.eventId)) {
            return null;
          }
          return prev;
        });
        break;

      case ServerMsg.PLAYER_LIST:
        setGameState(prev => prev ? { ...prev, players: payload } : null);
        break;

      case ServerMsg.SLIDE_QUEUE:
        setSlideQueue(payload);
        break;

      case ServerMsg.SLIDE:
        setCurrentSlide(payload);
        break;

      case ServerMsg.LOG:
        setLog(payload);
        break;

      case ServerMsg.EVENT_TIMER:
        if (payload.duration != null) {
          setEventTimers(prev => ({ ...prev, [payload.eventId]: { endsAt: Date.now() + payload.duration, duration: payload.duration } }));
        } else {
          setEventTimers(prev => {
            const next = { ...prev };
            delete next[payload.eventId];
            return next;
          });
        }
        break;

      case ServerMsg.EVENT_PROMPT:
        setEventPrompt(payload);
        setEventResult(null); // Clear previous event results when new event starts
        break;

      case ServerMsg.EVENT_RESULT:
        addNotification(payload.message, 'info');
        setEventResult(payload);
        setEventPrompt(null);
        break;

      case ServerMsg.PHASE_CHANGE:
        addNotification(`Phase changed to ${payload.phase}`, 'info');
        break;

      default:
        console.log('[WS] Unknown message:', type, payload);
    }
  }, []);

  // Add notification
  const addNotification = useCallback((message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  // Send message
  const send = useCallback((type, payload = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('[WS] Not connected, cannot send:', type);
    }
  }, []);

  // Connect on mount
  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  // Helper functions
  const joinAsPlayer = useCallback((playerId) => {
    send(ClientMsg.JOIN, { playerId });
  }, [send]);

  const rejoinAsPlayer = useCallback((playerId) => {
    send(ClientMsg.REJOIN, { playerId });
  }, [send]);

  const connectAsHost = useCallback(() => {
    send(ClientMsg.HOST_CONNECT);
  }, [send]);

  const connectAsScreen = useCallback(() => {
    send(ClientMsg.SCREEN_CONNECT);
  }, [send]);

  const value = {
    // Connection state
    connected,

    // Game state
    gameState,
    playerState,
    slideQueue,
    currentSlide,
    log,
    eventPrompt,
    eventResult,
    eventTimers,
    notifications,

    // Actions
    send,
    joinAsPlayer,
    rejoinAsPlayer,
    connectAsHost,
    connectAsScreen,
    addNotification,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
