// server/Game.test.js
// Integration tests for the Game state machine.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GamePhase, Team } from '../shared/constants.js'
import { createTestGame, startGameWithRoles } from './test/helpers.js'

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => '{}'),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

// ─── Lifecycle ────────────────────────────────────────────────────────────────

describe('Game lifecycle', () => {
  it('constructor: phase=LOBBY, dayCount=0', () => {
    const { game } = createTestGame(0)
    expect(game.phase).toBe(GamePhase.LOBBY)
    expect(game.dayCount).toBe(0)
  })

  it('addPlayer adds to players map', () => {
    const { game } = createTestGame(0)
    const ws = { send: vi.fn(), readyState: 1, source: 'web' }
    const result = game.addPlayer('1', ws)
    expect(result.success).toBe(true)
    expect(game.getPlayer('1')).not.toBeNull()
  })

  it('addPlayer returns error when game is in progress', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    const ws = { send: vi.fn(), readyState: 1, source: 'web' }
    const result = game.addPlayer('99', ws)
    expect(result.success).toBe(false)
  })

  it('removePlayer removes from players map', () => {
    const { game } = createTestGame(4)
    game.removePlayer('1')
    expect(game.getPlayer('1')).toBeNull()
  })

  it('reset clears players and returns to LOBBY', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    game.reset()
    expect(game.phase).toBe(GamePhase.LOBBY)
    expect(game.dayCount).toBe(0)
    expect(game.players.size).toBe(0)
  })
})

// ─── Phase transitions ────────────────────────────────────────────────────────

describe('phase transitions', () => {
  it('startGame in LOBBY with 4+ players → phase=DAY, dayCount=1', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    expect(game.phase).toBe(GamePhase.DAY)
    expect(game.dayCount).toBe(1)
  })

  it('startGame with < 4 players → returns error', () => {
    const { game } = createTestGame(3)
    const result = game.startGame()
    expect(result.success).toBe(false)
    expect(game.phase).toBe(GamePhase.LOBBY)
  })

  it('startGame when not LOBBY → returns error', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    const result = game.startGame()
    expect(result.success).toBe(false)
  })

  it('nextPhase DAY → NIGHT (same dayCount)', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    const day = game.dayCount
    game.nextPhase()
    expect(game.phase).toBe(GamePhase.NIGHT)
    expect(game.dayCount).toBe(day)
  })

  it('nextPhase NIGHT → DAY (dayCount increments)', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    game.nextPhase() // DAY → NIGHT
    const nightDay = game.dayCount
    game.nextPhase() // NIGHT → DAY
    expect(game.phase).toBe(GamePhase.DAY)
    expect(game.dayCount).toBe(nightDay + 1)
  })

  it('endGame sets phase to GAME_OVER', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    game.endGame(Team.CIRCLE)
    expect(game.phase).toBe(GamePhase.GAME_OVER)
  })
})

// ─── Role assignment ──────────────────────────────────────────────────────────

describe('role assignment', () => {
  it('every player gets a role after startGame', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    for (const p of players) {
      expect(p.role).not.toBeNull()
    }
  })

  it('startGameWithRoles assigns exact roles in seat order', () => {
    const { game } = createTestGame(5)
    startGameWithRoles(game, ['alpha', 'sleeper', 'seeker', 'nobody', 'nobody'])
    const seats = game.getPlayersBySeat()
    expect(seats[0].role.id).toBe('alpha')
    expect(seats[1].role.id).toBe('sleeper')
    expect(seats[2].role.id).toBe('seeker')
  })
})

// ─── Event lifecycle ──────────────────────────────────────────────────────────

describe('event lifecycle', () => {
  let game, players

  beforeEach(() => {
    ;({ game, players } = createTestGame(4))
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
  })

  it('startEvent creates active event', () => {
    const result = game.startEvent('vote')
    expect(result.success).toBe(true)
    expect(game.activeEvents.has('vote')).toBe(true)
  })

  it('startEvent on unknown event → error', () => {
    const result = game.startEvent('nonexistent')
    expect(result.success).toBe(false)
  })

  it('recordSelection stores selection', () => {
    game.startEvent('vote')
    game.recordSelection('2', '1')
    const instance = game.activeEvents.get('vote')
    expect(instance.results['2']).toBe('1')
  })
})

// ─── Vote resolution ──────────────────────────────────────────────────────────

describe('vote resolution', () => {
  let game

  beforeEach(() => {
    ;({ game } = createTestGame(4))
    // Use 4 villagers-equivalent — no judge (avoids pardon flow), no hunter
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
  })

  it('majority vote → outcome eliminated, victim killed', () => {
    game.startEvent('vote')
    game.recordSelection('1', '2')
    game.recordSelection('3', '2')
    game.recordSelection('4', '2')
    const result = game.resolveEvent('vote')
    expect(result.success).toBe(true)
    expect(result.resolution.outcome).toBe('eliminated')
    expect(game.getPlayer('2').isAlive).toBe(false)
  })

  it('all abstain → outcome no-kill, no one dies', () => {
    game.startEvent('vote')
    game.recordSelection('1', null)
    game.recordSelection('2', null)
    game.recordSelection('3', null)
    game.recordSelection('4', null)
    const result = game.resolveEvent('vote')
    expect(result.success).toBe(true)
    expect(result.resolution.outcome).toBe('no-kill')
    for (const p of game.players.values()) {
      expect(p.isAlive).toBe(true)
    }
  })

  it('tie → runoff triggered, vote stays active', () => {
    game.startEvent('vote')
    game.recordSelection('1', '2')
    game.recordSelection('2', '1')
    game.recordSelection('3', '2')
    game.recordSelection('4', '1')
    const result = game.resolveEvent('vote')
    // Either runoff triggered (event still active) or returned runoff info
    const voteActive = game.activeEvents.has('vote')
    const wasRunoff = voteActive || result.resolution?.runoff === true
    expect(wasRunoff).toBe(true)
  })
})

// ─── Death queue ──────────────────────────────────────────────────────────────

describe('death queue', () => {
  it('kill: player dies', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    game.killPlayer('2', 'test')
    expect(game.getPlayer('2').isAlive).toBe(false)
  })

  it('re-kill guard: killPlayer on dead player → returns false', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    game.killPlayer('2', 'test')
    const result = game.killPlayer('2', 'test-again')
    expect(result).toBe(false)
  })

  it('cupid-linked death: killing one kills the other', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    const p3 = game.getPlayer('3')
    const p4 = game.getPlayer('4')
    p3.linkedTo = '4'
    p4.linkedTo = '3'
    game.killPlayer('3', 'test')
    expect(p3.isAlive).toBe(false)
    expect(p4.isAlive).toBe(false)
  })

  it('alpha promotion: kill alpha with living werewolf → werewolf becomes alpha', () => {
    const { game } = createTestGame(5)
    startGameWithRoles(game, ['alpha', 'sleeper', 'seeker', 'nobody', 'nobody'])
    const wolf = game.getPlayer('2')
    game.killPlayer('1', 'test')
    expect(wolf.role.id).toBe('alpha')
  })
})

// ─── Win conditions ───────────────────────────────────────────────────────────

describe('win conditions', () => {
  it('all wolves dead → returns CIRCLE win', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    game.killPlayer('1', 'test') // kill alpha
    const winner = game.checkWinCondition()
    expect(winner).toBe(Team.CIRCLE)
  })

  it('wolves >= villagers → returns CELL win', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'sleeper', 'nobody', 'nobody'])
    game.killPlayer('3', 'test') // kill villager
    game.killPlayer('4', 'test') // kill villager — wolves(2) >= circle(0)
    const winner = game.checkWinCondition()
    expect(winner).toBe(Team.CELL)
  })

  it('mixed alive → returns null', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    expect(game.checkWinCondition()).toBeNull()
  })
})
