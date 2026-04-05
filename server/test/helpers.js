// server/test/helpers.js
// Shared test utilities: game factory, mock ws, deterministic role assignment.

import { vi } from 'vitest'
import { Game } from '../Game.js'
import { getRole } from '../definitions/roles.js'

/**
 * Create a mock WebSocket object.
 */
export function mockWs(source = 'web') {
  return { send: vi.fn(), readyState: 1, source }
}

/**
 * Create a test Game instance with N players and stubbed broadcast fns.
 * NOTE: caller must vi.mock('fs', ...) at module level before importing this.
 */
export function createTestGame(playerCount, options = {}) {
  const broadcast = vi.fn()
  const sendToHost = vi.fn()
  const sendToScreen = vi.fn()
  const game = new Game(broadcast, sendToHost, sendToScreen)

  const players = []
  for (let i = 1; i <= playerCount; i++) {
    const ws = mockWs()
    const result = game.addPlayer(String(i), ws)
    if (result.player) players.push(result.player)
  }

  if (options.names) {
    for (const [id, name] of Object.entries(options.names)) {
      const player = game.getPlayer(id)
      if (player) player.name = name
    }
  }

  return { game, players, spies: { broadcast, sendToHost, sendToScreen } }
}

/**
 * Start a game with a fixed role assignment (no shuffle).
 * Roles assigned to players in seat order.
 */
export function startGameWithRoles(game, roleIds) {
  const playerList = game.getPlayersBySeat()
  if (roleIds.length !== playerList.length) {
    throw new Error(`roleIds length (${roleIds.length}) !== player count (${playerList.length})`)
  }

  game.assignRoles = () => {
    for (let i = 0; i < playerList.length; i++) {
      const role = getRole(roleIds[i])
      if (!role) throw new Error(`Unknown role: ${roleIds[i]}`)
      playerList[i].assignRole(role)
    }
  }

  game.startGame()
}
