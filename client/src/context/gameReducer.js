// client/src/context/gameReducer.js
// State shape and reducer for GameContext. All server-message-driven state lives here.
// `connected` is intentionally absent — it is owned by useWebSocket.

const LOG_MAX_ENTRIES = 200

export const initialState = {
  gameState: null,
  playerState: null,
  slideQueue: { queue: [], currentIndex: -1, current: null },
  currentSlide: null,
  log: [],
  eventPrompt: null,
  eventResult: null,
  notifications: [],
  eventTimers: {},
  gamePresets: [],
  presetSettings: null,
  hostSettings: null,
  operatorState: { words: [], ready: false },
  scores: {},
  calibrationState: null,
}

export function gameReducer(state, action) {
  switch (action.type) {
    case 'SET_GAME_STATE':
      return { ...state, gameState: action.payload }

    case 'SET_PLAYER_STATE': {
      const playerState = action.payload
      // Clear eventPrompt if its event is no longer pending
      const eventPrompt = state.eventPrompt
        ? (playerState?.pendingEvents?.includes(state.eventPrompt.eventId) ? state.eventPrompt : null)
        : null
      return { ...state, playerState, eventPrompt }
    }

    case 'UPDATE_PLAYER_LIST':
      return {
        ...state,
        gameState: state.gameState ? { ...state.gameState, players: action.payload } : null,
      }

    case 'SET_SLIDE_QUEUE':
      return { ...state, slideQueue: action.payload }

    case 'SET_CURRENT_SLIDE':
      return { ...state, currentSlide: action.payload }

    case 'SET_LOG':
      return { ...state, log: action.payload }

    case 'APPEND_LOG': {
      const next = [...state.log, ...action.payload]
      return { ...state, log: next.length > LOG_MAX_ENTRIES ? next.slice(-LOG_MAX_ENTRIES) : next }
    }

    case 'UPDATE_EVENT_TIMER': {
      const p = action.payload
      if (p.paused) {
        const next = {}
        for (const [eid, t] of Object.entries(state.eventTimers)) {
          next[eid] = { ...t, paused: true, remaining: Math.max(0, t.endsAt - Date.now()) }
        }
        return { ...state, eventTimers: next }
      }
      if (p.cancelled) return { ...state, eventTimers: {} }
      if (p.duration != null) {
        return {
          ...state,
          eventTimers: {
            ...state.eventTimers,
            [p.eventId]: { endsAt: Date.now() + p.duration, duration: p.duration, paused: false },
          },
        }
      }
      const next = { ...state.eventTimers }
      delete next[p.eventId]
      return { ...state, eventTimers: next }
    }

    case 'SET_EVENT_PROMPT':
      return { ...state, eventPrompt: action.payload, eventResult: null }

    case 'SET_EVENT_RESULT':
      return { ...state, eventResult: action.payload, eventPrompt: null }

    case 'SET_GAME_PRESETS':
      return { ...state, gamePresets: action.payload }

    case 'SET_PRESET_SETTINGS':
      return { ...state, presetSettings: action.payload }

    case 'SET_HOST_SETTINGS':
      return { ...state, hostSettings: action.payload }

    case 'SET_OPERATOR_STATE':
      return { ...state, operatorState: action.payload }

    case 'SET_SCORES':
      return { ...state, scores: action.payload }

    case 'SET_CALIBRATION_STATE':
      return { ...state, calibrationState: action.payload }

    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [...state.notifications, action.payload] }

    case 'REMOVE_NOTIFICATION':
      return { ...state, notifications: state.notifications.filter(n => n.id !== action.payload) }

    default:
      return state
  }
}
