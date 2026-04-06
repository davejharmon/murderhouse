// client/src/context/GameContext.jsx
// Central state management via WebSocket

import { createContext, useContext, useReducer, useCallback } from 'react'
import { ServerMsg, ClientMsg } from '@shared/constants.js'
import { gameReducer, initialState } from './gameReducer.js'
import { useWebSocket } from '../hooks/useWebSocket.js'

const GameContext = createContext(null)

const WS_URL = import.meta.env.DEV
  ? `ws://${window.location.hostname}:8080`
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState)

  const addNotification = useCallback((message, type = 'info') => {
    const id = Date.now()
    dispatch({ type: 'ADD_NOTIFICATION', payload: { id, message, type } })
    setTimeout(() => dispatch({ type: 'REMOVE_NOTIFICATION', payload: id }), 5000)
  }, [])

  const handleMessage = useCallback((type, payload) => {
    switch (type) {
      case ServerMsg.WELCOME:
        console.log('[WS] Welcome:', payload)
        break

      case ServerMsg.ERROR:
        console.error('[WS] Error:', payload.message)
        addNotification(payload.message, 'error')
        break

      case ServerMsg.GAME_STATE:
        dispatch({ type: 'SET_GAME_STATE', payload })
        break

      case ServerMsg.PLAYER_STATE:
        dispatch({ type: 'SET_PLAYER_STATE', payload })
        break

      case ServerMsg.PLAYER_LIST:
        dispatch({ type: 'UPDATE_PLAYER_LIST', payload })
        break

      case ServerMsg.SLIDE_QUEUE:
        dispatch({ type: 'SET_SLIDE_QUEUE', payload })
        break

      case ServerMsg.SLIDE:
        dispatch({ type: 'SET_CURRENT_SLIDE', payload })
        break

      case ServerMsg.LOG:
        dispatch({ type: 'SET_LOG', payload })
        break

      case ServerMsg.LOG_APPEND:
        dispatch({ type: 'APPEND_LOG', payload })
        break

      case ServerMsg.EVENT_TIMER:
        dispatch({ type: 'UPDATE_EVENT_TIMER', payload })
        break

      case ServerMsg.EVENT_PROMPT:
        dispatch({ type: 'SET_EVENT_PROMPT', payload })
        break

      case ServerMsg.EVENT_RESULT:
        addNotification(payload.message, 'info')
        dispatch({ type: 'SET_EVENT_RESULT', payload })
        break

      case ServerMsg.PHASE_CHANGE:
        addNotification(`Phase changed to ${payload.phase}`, 'info')
        break

      case ServerMsg.GAME_PRESETS:
        dispatch({ type: 'SET_GAME_PRESETS', payload: payload.presets })
        break

      case ServerMsg.GAME_PRESET_LOADED:
        dispatch({ type: 'SET_PRESET_SETTINGS', payload })
        break

      case ServerMsg.HOST_SETTINGS:
        dispatch({ type: 'SET_HOST_SETTINGS', payload })
        break

      case ServerMsg.OPERATOR_STATE:
        dispatch({ type: 'SET_OPERATOR_STATE', payload })
        break

      case ServerMsg.SCORES:
        dispatch({ type: 'SET_SCORES', payload: payload.scores ?? {} })
        break

      case ServerMsg.CALIBRATION_STATE:
        dispatch({ type: 'SET_CALIBRATION_STATE', payload })
        break

      case ServerMsg.KICKED:
        console.log('[WS] Kicked from game')
        addNotification('You have been kicked from the game', 'error')
        break

      default:
        console.log('[WS] Unknown message:', type, payload)
    }
  }, [addNotification])

  const { connected, send } = useWebSocket(WS_URL, handleMessage)

  const joinAsPlayer = useCallback((playerId) => send(ClientMsg.JOIN, { playerId }), [send])
  const rejoinAsPlayer = useCallback((playerId) => send(ClientMsg.REJOIN, { playerId }), [send])
  const connectAsHost = useCallback(() => send(ClientMsg.HOST_CONNECT), [send])
  const connectAsScreen = useCallback(() => send(ClientMsg.SCREEN_CONNECT), [send])
  const clearPresetSettings = useCallback(() => dispatch({ type: 'SET_PRESET_SETTINGS', payload: null }), [])

  const value = {
    // Connection state
    connected,

    // Game state (spread from reducer)
    ...state,

    // Actions
    send,
    joinAsPlayer,
    rejoinAsPlayer,
    connectAsHost,
    connectAsScreen,
    addNotification,
    clearPresetSettings,
  }

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error('useGame must be used within a GameProvider')
  }
  return context
}
