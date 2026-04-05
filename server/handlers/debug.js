// server/handlers/debug.js
// Handlers for debug-mode auto-selection. Only active when DEBUG_MODE is enabled.

import { ClientMsg, DEBUG_MODE } from '../../shared/constants.js'
import { requireHost } from './utils.js'

export function createDebugHandlers(game) {
  return {
    [ClientMsg.DEBUG_AUTO_SELECT]: requireHost((ws, payload) => {
      if (!DEBUG_MODE) return { success: false, error: 'Debug mode not enabled' }

      const player = game.getPlayer(payload.playerId)
      if (!player) return { success: false, error: 'Player not found' }

      // Find active event for this player
      let eventId = null
      for (const [eid, instance] of game.activeEvents) {
        if (instance.participants.includes(player.id)) {
          eventId = eid
          break
        }
      }

      if (!eventId) return { success: false, error: 'Player has no active event' }

      const instance = game.activeEvents.get(eventId)
      const event = instance.event
      const targets = event.validTargets(player, game)

      if (targets.length === 0) {
        // No targets, just abstain
        player.abstain()
        game.recordSelection(player.id, null)
        return { success: true, action: 'abstained' }
      }

      // Boolean events (self-target): 50% chance to abstain
      if (targets.length === 1 && targets[0].id === player.id && Math.random() < 0.5) {
        player.abstain()
        game.recordSelection(player.id, null)
        return { success: true, action: 'abstained' }
      }

      // Pick random target
      const randomTarget = targets[Math.floor(Math.random() * targets.length)]
      player.currentSelection = randomTarget.id
      player.confirmSelection()
      game.recordSelection(player.id, randomTarget.id)

      return { success: true, action: 'selected', targetId: randomTarget.id }
    }),

    [ClientMsg.DEBUG_AUTO_SELECT_ALL]: requireHost((ws, payload) => {
      if (!DEBUG_MODE) return { success: false, error: 'Debug mode not enabled' }

      const { eventId } = payload
      const instance = game.activeEvents.get(eventId)
      if (!instance) return { success: false, error: 'Event not active' }

      const { event, participants, results } = instance
      let autoSelectedCount = 0

      // Auto-select for all participants who haven't locked in a selection
      for (const playerId of participants) {
        const player = game.getPlayer(playerId)
        if (!player) continue

        // Skip if player already has a result recorded
        if (playerId in results) continue

        const targets = event.validTargets(player, game)

        if (targets.length === 0) {
          // No targets, abstain
          player.abstain()
          game.recordSelection(player.id, null)
          autoSelectedCount++
        } else {
          // Pick random target
          const randomTarget = targets[Math.floor(Math.random() * targets.length)]
          player.currentSelection = randomTarget.id
          player.confirmSelection()
          game.recordSelection(player.id, randomTarget.id)
          autoSelectedCount++
        }
      }

      return { success: true, autoSelectedCount }
    }),
  }
}
