// server/handlers/host.js
// Handlers for all host-only game commands.

import { ClientMsg, ServerMsg, SlideType, SlideStyle } from '../../shared/constants.js'
import { getRole } from '../definitions/roles.js'
import { str } from '../strings.js'
import { requireHost, send } from './utils.js'

export function createHostHandlers(game, clients) {
  return {
    // === Game Flow ===

    [ClientMsg.START_GAME]: requireHost(() => game.startGame()),

    [ClientMsg.NEXT_PHASE]: requireHost(() => game.nextPhase()),

    [ClientMsg.END_GAME]: requireHost((ws, payload) => {
      game.endGame(payload?.winner || null)
      return { success: true }
    }),

    [ClientMsg.RESET_GAME]: requireHost(() => {
      game.reset()

      // Re-add connected player clients to the new lobby
      for (const client of clients) {
        if (client.readyState !== 1 || client.clientType !== 'player' || !client.playerId) continue
        const existing = game.getPlayer(client.playerId)
        if (existing) {
          // Additional connection for same player (e.g. web + terminal)
          existing.addConnection(client)
        } else {
          const result = game.addPlayer(client.playerId, client)
          if (!result.success) continue
        }
        const player = game.getPlayer(client.playerId)
        send(client, ServerMsg.WELCOME, {
          playerId: client.playerId,
          player: player.getPrivateState(game),
        })
        send(client, ServerMsg.PLAYER_STATE, player.getPrivateState(game))
        if (client.source === 'terminal') {
          send(client, ServerMsg.HEARTRATE_MONITOR, {
            enabled: game._isHeartrateNeeded(client.playerId),
          })
        }
      }

      // Broadcast updated state to all
      game.broadcastGameState()
      game.broadcastPlayerList()
      game.broadcastSlides()
      return { success: true }
    }),

    // === Events ===

    [ClientMsg.START_EVENT]: requireHost((ws, payload) => game.startEvent(payload.eventId)),

    [ClientMsg.START_ALL_EVENTS]: requireHost(() => game.startAllEvents()),

    [ClientMsg.CREATE_CUSTOM_EVENT]: requireHost((ws, payload) => {
      const { mechanism, rewardType, rewardParam, description } = payload
      return game.createCustomEvent({
        mechanism: mechanism || 'vote',
        rewardType,
        rewardParam,
        description,
      })
    }),

    [ClientMsg.RESOLVE_EVENT]: requireHost((ws, payload) => game.resolveEvent(payload.eventId)),

    [ClientMsg.RESOLVE_ALL_EVENTS]: requireHost(() => game.resolveAllEvents()),

    [ClientMsg.SKIP_EVENT]: requireHost((ws, payload) => game.skipEvent(payload.eventId)),

    [ClientMsg.RESET_EVENT]: requireHost((ws, payload) => game.resetEvent(payload.eventId)),

    [ClientMsg.START_EVENT_TIMER]: requireHost((ws, payload) =>
      game.startAllEventTimers(payload.duration)
    ),
    [ClientMsg.PAUSE_EVENT_TIMER]: requireHost(() => game.pauseEventTimers()),
    [ClientMsg.RESUME_EVENT_TIMER]: requireHost(() => game.resumeEventTimers()),
    [ClientMsg.CANCEL_EVENT_TIMER]: requireHost(() => game.cancelEventTimers()),

    // === Slide Controls ===

    [ClientMsg.NEXT_SLIDE]: requireHost(() => {
      game.nextSlide()
      return { success: true }
    }),

    [ClientMsg.PREV_SLIDE]: requireHost(() => {
      game.prevSlide()
      return { success: true }
    }),

    [ClientMsg.PUSH_SLIDE]: requireHost((ws, payload) => {
      game.pushSlide(payload.slide, payload.jumpTo)
      return { success: true }
    }),

    [ClientMsg.CLEAR_SLIDES]: requireHost(() => {
      game.clearSlides()
      return { success: true }
    }),

    // === Player Management ===

    [ClientMsg.CHANGE_ROLE]: requireHost((ws, payload) => {
      const player = game.getPlayer(payload.playerId)
      if (!player) return { success: false, error: 'Player not found' }
      const role = getRole(payload.roleId)
      if (!role) return { success: false, error: 'Role not found' }
      const oldRoleName = player.role?.name || 'None'
      player.assignRole(role)
      game._invalidateWinCache() // Team may have changed
      game.addLog(
        str('log', 'roleChanged', {
          name: player.getNameWithEmoji(),
          old: oldRoleName,
          new: role.name,
        })
      )
      game.broadcastGameState()
      return { success: true }
    }),

    [ClientMsg.PRE_ASSIGN_ROLE]: requireHost((ws, payload) =>
      game.preAssignRole(payload.playerId, payload.roleId)
    ),

    [ClientMsg.RANDOMIZE_ROLES]: requireHost(() => game.randomizeRoles()),

    [ClientMsg.KICK_PLAYER]: requireHost((ws, payload) => game.removePlayer(payload.playerId)),

    [ClientMsg.KILL_PLAYER]: requireHost((ws, payload) => {
      const player = game.getPlayer(payload.playerId)
      if (!player) return { success: false, error: 'Player not found' }
      game.killPlayer(payload.playerId, 'host')
      game.addLog(str('log', 'killedByHost', { name: player.getNameWithEmoji() }))
      // Queue death slide (queueDeathSlide handles hunter revenge automatically)
      game.queueDeathSlide(game.createDeathSlide(player, 'host'), true)
      game.broadcastGameState()
      return { success: true }
    }),

    [ClientMsg.REVIVE_PLAYER]: requireHost((ws, payload) => {
      const player = game.getPlayer(payload.playerId)
      if (player) {
        game.revivePlayer(payload.playerId, 'host')
        game.broadcastGameState()
        return { success: true }
      }
      return { success: false, error: 'Player not found' }
    }),

    [ClientMsg.SET_PLAYER_PORTRAIT]: requireHost((ws, payload) => {
      // Validate portrait filename (alphanumeric + .png, no path traversal)
      if (!/^[a-zA-Z0-9_-]+\.png$/.test(payload.portrait)) {
        return { success: false, error: 'Invalid portrait' }
      }

      const player = game.getPlayer(payload.playerId)
      if (!player) return { success: false, error: 'Player not found' }

      player.portrait = payload.portrait
      game.persistPlayerCustomization(player)
      game.broadcastPlayerList()
      return { success: true }
    }),

    [ClientMsg.GIVE_ITEM]: requireHost((ws, payload) => {
      const result = game.giveItem(payload.playerId, payload.itemId)
      if (result.success) {
        game.broadcastGameState()
      }
      return result
    }),

    [ClientMsg.REMOVE_ITEM]: requireHost((ws, payload) => {
      const player = game.getPlayer(payload.playerId)
      if (!player) return { success: false, error: 'Player not found' }
      const removed = game.removeItem(payload.playerId, payload.itemId)
      if (removed) {
        game.addLog(
          str('log', 'itemRemoved', { name: player.getNameWithEmoji(), item: payload.itemId })
        )
        game.broadcastGameState()
        return { success: true }
      }
      return { success: false, error: 'Item not found in inventory' }
    }),

    // === Lobby Tutorial Slides ===

    [ClientMsg.PUSH_COMP_SLIDE]: requireHost(() => game.pushCompSlide()),

    [ClientMsg.PUSH_ROLE_TIP_SLIDE]: requireHost((ws, payload) =>
      game.pushRoleTipSlide(payload.roleId)
    ),

    [ClientMsg.PUSH_ITEM_TIP_SLIDE]: requireHost((ws, payload) =>
      game.pushItemTipSlide(payload.itemId)
    ),

    // === Game Presets ===

    [ClientMsg.LIST_GAME_PRESETS]: requireHost((ws) => {
      send(ws, ServerMsg.GAME_PRESETS, game.getGamePresets())
      return { success: true }
    }),

    [ClientMsg.SAVE_GAME_PRESET]: requireHost((ws, payload) => {
      const { name, timerDuration, autoAdvanceEnabled, fakeHeartbeats, overwriteId } = payload
      game.saveGamePreset(name, timerDuration, autoAdvanceEnabled, fakeHeartbeats, overwriteId)
      send(ws, ServerMsg.GAME_PRESETS, game.getGamePresets())
      return { success: true }
    }),

    [ClientMsg.LOAD_GAME_PRESET]: requireHost((ws, payload) => {
      const result = game.loadGamePreset(payload.id)
      if (!result) return { success: false, error: 'Preset not found' }
      send(ws, ServerMsg.GAME_PRESET_LOADED, result)
      game.broadcastGameState()
      return { success: true }
    }),

    [ClientMsg.DELETE_GAME_PRESET]: requireHost((ws, payload) => {
      game.deleteGamePreset(payload.id)
      send(ws, ServerMsg.GAME_PRESETS, game.getGamePresets())
      return { success: true }
    }),

    // === Host Settings ===

    [ClientMsg.SAVE_HOST_SETTINGS]: requireHost((ws, payload) => {
      game.saveHostSettings(payload)
      return { success: true }
    }),

    [ClientMsg.SET_DEFAULT_PRESET]: requireHost((ws, payload) => {
      game.setDefaultPreset(payload.id)
      send(ws, ServerMsg.HOST_SETTINGS, game.getHostSettings())
      return { success: true }
    }),

    // === Heartbeat Controls ===

    [ClientMsg.TOGGLE_HEARTBEAT_MODE]: requireHost(() => game.toggleHeartbeatMode()),
    [ClientMsg.TOGGLE_FAKE_HEARTBEATS]: requireHost(() => game.toggleFakeHeartbeats()),

    [ClientMsg.START_CALIBRATION]: requireHost(() => {
      const playerIds = [...game.players.values()]
        .filter((p) => p.heartbeat?.active || p.heartbeat?.fake)
        .map((p) => p.id)
      if (!playerIds.length) return { success: false, error: 'No active sensors' }
      return game.startCalibration(playerIds)
    }),

    [ClientMsg.START_SINGLE_CALIBRATION]: requireHost((ws, payload) => {
      if (!payload.playerId) return { success: false, error: 'No player specified' }
      return game.startSingleCalibration(payload.playerId)
    }),

    [ClientMsg.STOP_CALIBRATION]: requireHost(() => game.stopCalibration()),
    [ClientMsg.SAVE_CALIBRATION]: requireHost(() => game.saveCalibration()),

    [ClientMsg.TOGGLE_PLAYER_HEARTBEAT]: requireHost((ws, payload) => {
      if (!payload.playerId) return { success: false, error: 'No player specified' }
      return game.togglePlayerHeartbeat(payload.playerId)
    }),

    [ClientMsg.SET_PLAYER_CALIBRATION]: requireHost((ws, payload) => {
      if (!payload.playerId) return { success: false, error: 'No player specified' }
      return game.setPlayerCalibration(payload.playerId, payload.restingBpm, payload.elevatedBpm)
    }),

    [ClientMsg.TOGGLE_PLAYER_SIMULATED]: requireHost((ws, payload) => {
      if (!payload.playerId) return { success: false, error: 'No player specified' }
      return game.togglePlayerSimulated(payload.playerId)
    }),

    [ClientMsg.PUSH_HEARTBEAT_SLIDE]: requireHost((ws, payload) => {
      const player = game.getPlayer(payload.playerId)
      if (!player) return { success: false, error: 'Player not found' }
      const bpm = player.heartbeat?.bpm || 0
      const fake = player.heartbeat?.fake ?? false
      game.pushSlide(
        {
          type: SlideType.HEARTBEAT,
          playerId: payload.playerId,
          playerName: player.name,
          portrait: player.portrait,
          bpm,
          fake,
          style: SlideStyle.HOSTILE,
        },
        true
      )
      return { success: true }
    }),

    // === Operator Send (host-only) ===

    [ClientMsg.OPERATOR_SEND]: requireHost(() => {
      game.operatorSend()
      return { success: true }
    }),

    // === Scores ===

    [ClientMsg.SET_SCORE]: requireHost((ws, payload) => {
      if (typeof payload.name !== 'string' || typeof payload.score !== 'number') {
        return { success: false, error: 'Invalid payload' }
      }
      game.setScore(payload.name, payload.score)
      return { success: true }
    }),

    [ClientMsg.PUSH_SCORE_SLIDE]: requireHost(() => {
      game.pushScoreSlide()
      return { success: true }
    }),

    // === Firmware Update ===

    [ClientMsg.TRIGGER_FIRMWARE_UPDATE]: requireHost(() => {
      let updated = 0
      for (const player of game.players.values()) {
        for (const ws of player.connections) {
          if (ws && ws.readyState === 1 && ws.source === 'terminal') {
            ws.send(JSON.stringify({ type: ServerMsg.UPDATE_FIRMWARE, payload: {} }))
            updated++
          }
        }
      }
      console.log(`[Firmware] Triggered OTA update on ${updated} terminal(s)`)
      return { success: true, terminalsUpdated: updated }
    }),
  }
}
