// server/handlers/connection.js
// Handlers for initial client connections (players, host, screen).

import { ClientMsg, ServerMsg } from '../../shared/constants.js'
import { send } from './utils.js'

export function createConnectionHandlers(game) {
  return {
    [ClientMsg.JOIN]: (ws, payload) => {
      const { playerId, source, firmwareVersion } = payload
      ws.source = source || 'web'
      if (firmwareVersion) ws.firmwareVersion = firmwareVersion

      // Check if player already exists (reconnection)
      const existing = game.getPlayer(playerId)
      if (existing) {
        const result = game.reconnectPlayer(playerId, ws)
        if (result.success) {
          ws.playerId = playerId
          ws.clientType = 'player'
          send(ws, ServerMsg.WELCOME, {
            playerId,
            reconnected: true,
            player: existing.getPrivateState(game, { forSelf: true }),
          })
          send(ws, ServerMsg.GAME_STATE, game.getGameState())
          send(ws, ServerMsg.PLAYER_STATE, existing.getPrivateState(game, { forSelf: true }))
          if (ws.source === 'terminal') {
            send(ws, ServerMsg.HEARTRATE_MONITOR, { enabled: game._isHeartrateNeeded(playerId) })
          }
          // Notify others of reconnection - broadcastGameState after broadcastPlayerList
          // ensures host gets role info (PLAYER_LIST only has public state)
          game.broadcastPlayerList()
          game.broadcastGameState()
        }
        return result
      }

      // New player
      const result = game.addPlayer(playerId, ws)
      if (result.success) {
        ws.playerId = playerId
        ws.clientType = 'player'
        send(ws, ServerMsg.WELCOME, {
          playerId,
          player: result.player.getPrivateState(game),
        })
        send(ws, ServerMsg.GAME_STATE, game.getGameState())
        send(ws, ServerMsg.PLAYER_STATE, result.player.getPrivateState(game))
        if (ws.source === 'terminal') {
          send(ws, ServerMsg.HEARTRATE_MONITOR, { enabled: game._isHeartrateNeeded(playerId) })
        }
      }
      // Don't send error here — handleMessage sends it from the returned result.
      return result
    },

    [ClientMsg.REJOIN]: (ws, payload) => {
      const { playerId, source, firmwareVersion } = payload
      ws.source = source || 'web'
      if (firmwareVersion) ws.firmwareVersion = firmwareVersion
      const result = game.reconnectPlayer(playerId, ws)

      if (result.success) {
        ws.playerId = playerId
        ws.clientType = 'player'
        send(ws, ServerMsg.WELCOME, {
          playerId,
          reconnected: true,
          player: result.player.getPrivateState(game),
        })
        send(ws, ServerMsg.GAME_STATE, game.getGameState())
        send(ws, ServerMsg.PLAYER_STATE, result.player.getPrivateState(game))
        if (ws.source === 'terminal') {
          send(ws, ServerMsg.HEARTRATE_MONITOR, { enabled: game._isHeartrateNeeded(playerId) })
        }
        // Notify others of reconnection - broadcastGameState after broadcastPlayerList
        // ensures host gets role info (PLAYER_LIST only has public state)
        game.broadcastPlayerList()
        game.broadcastGameState()
      }
      // Don't send error here — handleMessage sends it from the returned result.
      // Sending it explicitly caused a double-error that broke the terminal's
      // REJOIN→JOIN fallback (second error arrived after triedJoinFallback was set).
      return result
    },

    [ClientMsg.HOST_CONNECT]: (ws) => {
      game.host = ws
      ws.clientType = 'host'
      send(ws, ServerMsg.WELCOME, { role: 'host' })
      send(ws, ServerMsg.GAME_STATE, game.getGameState({ audience: 'host' }))
      send(ws, ServerMsg.PLAYER_LIST, game.getPlayersBySeat().map((p) => p.getPrivateState(game)))
      send(ws, ServerMsg.SLIDE_QUEUE, {
        queue: game.slideQueue,
        currentIndex: game.currentSlideIndex,
        current: game.getCurrentSlide(),
      })
      send(ws, ServerMsg.LOG, game.log.slice(-50))
      send(ws, ServerMsg.GAME_PRESETS, game.getGamePresets())
      send(ws, ServerMsg.HOST_SETTINGS, game.getHostSettings())
      send(ws, ServerMsg.SCORES, { scores: game.getScoresObject() })
      return { success: true }
    },

    [ClientMsg.SCREEN_CONNECT]: (ws) => {
      game.screen = ws
      ws.clientType = 'screen'
      send(ws, ServerMsg.WELCOME, { role: 'screen' })
      send(ws, ServerMsg.GAME_STATE, game.getGameState())
      send(ws, ServerMsg.SLIDE, game.getCurrentSlide())
      return { success: true }
    },
  }
}
