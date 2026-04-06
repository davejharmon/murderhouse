// server/EventResolver.test.js
// Isolated unit tests for EventResolver with a mock game object.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GamePhase } from '../shared/constants.js'
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

// ─── EventResolver via game.events proxy ──────────────────────────────────────

describe('EventResolver.buildPendingEvents', () => {
  it('builds night pending events for all eligible roles', () => {
    const { game } = createTestGame(5)
    startGameWithRoles(game, ['alpha', 'medic', 'seeker', 'nobody', 'nobody'])
    game.nextPhase() // DAY → NIGHT

    // After nextPhase builds pending events, alpha/medic/seeker should be included
    // vote is day-only so absent; protect/investigate/kill/suspect should be pending
    expect(game.events.pendingEvents).toContain('kill')
    expect(game.events.pendingEvents).toContain('protect')
    expect(game.events.pendingEvents).toContain('investigate')
  })

  it('does not include vote in night pending events', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    game.nextPhase() // DAY → NIGHT

    expect(game.events.pendingEvents).not.toContain('vote')
  })

  it('does not include events with no participants', () => {
    const { game } = createTestGame(4)
    // No medic role — protect has no participants
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    game.nextPhase()

    expect(game.events.pendingEvents).not.toContain('protect')
  })
})

describe('EventResolver.startEvent', () => {
  it('returns success:false for unknown event', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    const result = game.startEvent('nonexistent_event_xyz')
    expect(result.success).toBe(false)
  })

  it('moves event from pending to active', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    game.nextPhase() // DAY → NIGHT

    expect(game.events.pendingEvents).toContain('kill')
    game.startEvent('kill')
    expect(game.events.pendingEvents).not.toContain('kill')
    expect(game.events.activeEvents.has('kill')).toBe(true)
  })

  it('starting an already-active event overwrites the instance', () => {
    // The game design allows re-starting an active event (e.g., for resets).
    // This test documents the actual behaviour: the second startEvent succeeds.
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    game.nextPhase()

    game.startEvent('kill')
    const result = game.startEvent('kill')
    // Overwrites the existing instance, returns success
    expect(result.success).toBe(true)
    // Only one kill instance active (not duplicated)
    expect([...game.events.activeEvents.keys()].filter(k => k === 'kill').length).toBe(1)
  })
})

describe('EventResolver.resolveEvent', () => {
  it('returns success:false when event is not active', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])

    const result = game.resolveEvent('kill')
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('returns success:true after successful resolve', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    game.nextPhase()

    game.startEvent('kill')
    game.recordSelection(players[0].id, players[2].id)
    const result = game.resolveEvent('kill')

    expect(result.success).toBe(true)
  })

  it('event removed from activeEvents after resolve', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    game.nextPhase()

    game.startEvent('kill')
    game.recordSelection(players[0].id, players[2].id)
    game.resolveEvent('kill')

    expect(game.events.activeEvents.has('kill')).toBe(false)
  })
})

describe('EventResolver.getEventParticipants', () => {
  it('returns empty array for unknown event', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    const participants = game.events.getEventParticipants('does_not_exist')
    expect(participants).toEqual([])
  })

  it('excludes coward holders from participants', () => {
    const { game, players } = createTestGame(5)
    startGameWithRoles(game, ['alpha', 'nobody', 'nobody', 'nobody', 'nobody'])

    // Give nobody a coward item — they normally participate in 'suspect'
    // but coward excludes them
    game.nextPhase() // DAY → NIGHT
    game.giveItem(players[1].id, 'coward')

    const participants = game.events.getEventParticipants('suspect')
    expect(participants.find(p => p.id === players[1].id)).toBeUndefined()
  })
})

describe('EventResolver._applyRoleblocks', () => {
  it('nulls out roleblocked actor target', () => {
    const { game, players } = createTestGame(5)
    startGameWithRoles(game, ['alpha', 'handler', 'seeker', 'nobody', 'nobody'])
    game.nextPhase()

    const alpha = players[0]
    alpha.isRoleblocked = true

    game.startEvent('kill')
    game.recordSelection(alpha.id, players[3].id)
    game.resolveEvent('kill')

    expect(players[3].isAlive).toBe(true)
  })
})

describe('EventResolver.clearForPhase', () => {
  it('clears activeEvents and eventResults', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    game.nextPhase()

    game.startEvent('kill')
    expect(game.events.activeEvents.size).toBe(1)

    game.events.clearForPhase()
    expect(game.events.activeEvents.size).toBe(0)
    expect(game.events.eventResults).toEqual([])
  })
})

describe('EventResolver.reset', () => {
  it('resets all state to initial values', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    game.nextPhase()

    game.startEvent('kill')
    game.events.reset()

    expect(game.events.pendingEvents).toEqual([])
    expect(game.events.activeEvents.size).toBe(0)
    expect(game.events.eventResults).toEqual([])
  })
})
