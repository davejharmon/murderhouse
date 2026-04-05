// server/handlers/player.js
// Handlers for player actions, operator terminal, and heartbeat sensor data.

import { ClientMsg, ServerMsg } from '../../shared/constants.js'
import { getItem } from '../definitions/items.js'
import { send } from './utils.js'

export function createPlayerHandlers(game) {
  return {
    // === Player Actions ===

    [ClientMsg.SET_NAME]: (ws, payload) => {
      // Allow both players to set their own name and hosts to set any player's name
      let player
      if (ws.clientType === 'host' && payload.playerId) {
        player = game.getPlayer(payload.playerId)
      } else {
        player = game.getPlayer(ws.playerId)
      }

      if (!player) return { success: false, error: 'Player not found' }

      player.name = payload.name.slice(0, 20) // Max 20 chars
      game.persistPlayerCustomization(player)
      game.broadcastPlayerList()
      return { success: true }
    },

    [ClientMsg.SELECT_UP]: (ws) => {
      const player = game.getPlayer(ws.playerId)
      if (!player) return { success: false, error: 'Not a player' }

      // Find next unresolved active event and valid targets
      for (const [eventId, instance] of game.activeEvents) {
        if (instance.participants.includes(player.id) && !(player.id in instance.results)) {
          const event = instance.event
          const targets = event.validTargets(player, game)
          const selected = player.selectUp(targets)

          player.syncState(game)
          game.debouncedBroadcastGameState() // Debounced - host updates after dial settles

          // Broadcast pack state for cell events (real-time selection sharing)
          if (game.shouldBroadcastPackState(eventId, player)) {
            game.broadcastPackState()
          }

          return { success: true, selected }
        }
      }

      return { success: false, error: 'No active event' }
    },

    [ClientMsg.SELECT_DOWN]: (ws) => {
      const player = game.getPlayer(ws.playerId)
      if (!player) return { success: false, error: 'Not a player' }

      for (const [eventId, instance] of game.activeEvents) {
        if (instance.participants.includes(player.id) && !(player.id in instance.results)) {
          const event = instance.event
          const targets = event.validTargets(player, game)
          const selected = player.selectDown(targets)

          player.syncState(game)
          game.debouncedBroadcastGameState() // Debounced - host updates after dial settles

          // Broadcast pack state for cell events (real-time selection sharing)
          if (game.shouldBroadcastPackState(eventId, player)) {
            game.broadcastPackState()
          }

          return { success: true, selected }
        }
      }

      return { success: false, error: 'No active event' }
    },

    // Settle update from terminal: sets selection by targetId after dial stops moving.
    // No syncState — terminal already shows correct state; we only need server + pack in sync.
    [ClientMsg.SELECT_TO]: (ws, payload) => {
      const player = game.getPlayer(ws.playerId)
      if (!player) return { success: false, error: 'Not a player' }
      if (!payload?.targetId) return { success: false, error: 'Missing targetId' }

      player.currentSelection = payload.targetId
      game.debouncedBroadcastGameState()

      for (const [eventId] of game.activeEvents) {
        if (game.shouldBroadcastPackState(eventId, player)) {
          game.broadcastPackState()
          break
        }
      }

      return { success: true }
    },

    [ClientMsg.CONFIRM]: (ws, payload) => {
      const player = game.getPlayer(ws.playerId)
      if (!player) return { success: false, error: 'Not a player' }

      // ESP32 terminals send the explicit targetId to bypass stale server-side selection
      // (caused by rate-limited SELECT messages during rapid dial scrubbing)
      if (payload?.targetId) {
        player.currentSelection = payload.targetId
      }

      const targetId = player.confirmSelection()
      if (targetId === null) {
        return { success: false, error: 'Nothing selected' }
      }

      const result = game.recordSelection(player.id, targetId)
      player.syncState(game)

      return result
    },

    [ClientMsg.CANCEL]: (ws) => {
      const player = game.getPlayer(ws.playerId)
      if (!player) return { success: false, error: 'Not a player' }

      player.cancelSelection()
      player.syncState(game)

      return { success: true }
    },

    [ClientMsg.ABSTAIN]: (ws) => {
      const player = game.getPlayer(ws.playerId)
      if (!player) return { success: false, error: 'Not a player' }

      // Find player's next unresolved event and check if abstaining is allowed
      for (const [, instance] of game.activeEvents) {
        if (instance.participants.includes(player.id) && !(player.id in instance.results)) {
          if (!instance.event.allowAbstain) {
            return { success: false, error: 'Cannot abstain from this event' }
          }
          break
        }
      }

      player.abstain()
      const result = game.recordSelection(player.id, null)
      player.syncState(game)

      return result
    },

    [ClientMsg.IDLE_SCROLL_UP]: (ws) => {
      const player = game.getPlayer(ws.playerId)
      if (!player) return { success: false, error: 'Not a player' }
      if (!player.isAlive || player.pendingEvents.size > 0) {
        return { success: false, error: 'Cannot scroll now' }
      }

      player.idleScrollUp()
      player.syncState(game)
      return { success: true }
    },

    [ClientMsg.IDLE_SCROLL_DOWN]: (ws) => {
      const player = game.getPlayer(ws.playerId)
      if (!player) return { success: false, error: 'Not a player' }
      if (!player.isAlive || player.pendingEvents.size > 0) {
        return { success: false, error: 'Cannot scroll now' }
      }

      player.idleScrollDown()
      player.syncState(game)
      return { success: true }
    },

    [ClientMsg.USE_ITEM]: (ws, payload) => {
      const player = game.getPlayer(ws.playerId)
      if (!player) return { success: false, error: 'Not a player' }

      const { itemId } = payload

      if (!player.hasItem(itemId)) {
        return { success: false, error: 'Item not in inventory' }
      }

      if (!player.canUseItem(itemId)) {
        return { success: false, error: 'Item has no uses remaining' }
      }

      const itemDef = getItem(itemId)
      if (!itemDef?.startsEvent) {
        return { success: false, error: 'Item cannot be activated' }
      }

      // Start the event for this player only — not all eligible participants
      return game.startEventForPlayer(itemDef.startsEvent, player.id)
    },

    // === Heartbeat Sensor Data ===

    [ClientMsg.HEARTBEAT]: (ws, payload) => {
      const player = game.getPlayer(ws.playerId)
      if (!player) return { success: false, error: 'Not a player' }

      // Don't let real sensor overwrite simulated heartbeat
      const cal = game._hostSettings?.heartbeatCalibration?.[ws.playerId]
      if (cal?.simulated) {
        // Still collect calibration samples from real sensor if calibrating
        if (game._calibration) {
          const tmpHeartbeat = player.heartbeat
          player.heartbeat = { ...tmpHeartbeat, bpm: payload.bpm || 0 }
          game.collectCalibrationSample(player)
          player.heartbeat = tmpHeartbeat
        }
        return { success: true }
      }

      player.heartbeat = {
        bpm: payload.bpm || 0,
        active: (payload.bpm || 0) > 0,
        fake: payload.fake === true,
        lastUpdate: Date.now(),
      }
      // Collect calibration sample if calibration is active
      if (game._calibration) {
        game.collectCalibrationSample(player)
        game._broadcastCalibrationState()
      }
      game._checkHeartbeatModeSpike(player)
      game.broadcastGameState()
      return { success: true }
    },

    // === Operator Terminal ===

    [ClientMsg.OPERATOR_JOIN]: (ws) => {
      ws.clientType = 'operator'
      send(ws, ServerMsg.WELCOME, { role: 'operator' })
      send(ws, ServerMsg.OPERATOR_STATE, game.getOperatorState())
      return { success: true }
    },

    [ClientMsg.OPERATOR_ADD]: (ws, payload) => {
      if (!payload.word || typeof payload.word !== 'string') {
        return { success: false, error: 'Invalid word' }
      }
      game.operatorAdd(payload.word)
      return { success: true }
    },

    [ClientMsg.OPERATOR_DELETE]: () => {
      game.operatorDelete()
      return { success: true }
    },

    [ClientMsg.OPERATOR_READY]: () => {
      game.operatorSetReady(true)
      return { success: true }
    },

    [ClientMsg.OPERATOR_UNREADY]: () => {
      game.operatorSetReady(false)
      return { success: true }
    },

    [ClientMsg.OPERATOR_CLEAR]: () => {
      game.operatorClear()
      return { success: true }
    },
  }
}
