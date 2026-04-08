// server/mechanics/items.mechanics.test.js
// Per-item activation, effect, and consumption rule tests.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GamePhase } from '../../shared/constants.js'
import { createTestGame, startGameWithRoles } from '../test/helpers.js'

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

// ─── Pistol ───────────────────────────────────────────────────────────────────

describe('Pistol', () => {
  it('pistol starts shoot event during DAY', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])

    game.giveItem(players[1].id, 'pistol')
    const result = game.startEvent('shoot')
    expect(result.success).toBe(true)
  })

  it('shoot event during NIGHT returns error (day-phase item)', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])

    game.giveItem(players[1].id, 'pistol')
    game.nextPhase() // DAY → NIGHT

    // The pistol is phase-restricted to DAY — startEvent checks phase for playerInitiated events
    const result = game.startEvent('shoot')
    expect(result.success).toBe(false)
  })
})

// ─── Clue ─────────────────────────────────────────────────────────────────────

describe('Clue', () => {
  it('clue adds holder to investigate participants (grantsParticipation)', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'citizen', 'citizen', 'citizen'])
    game.nextPhase() // DAY → NIGHT

    // nobody at seat 2 gets a clue — investigate normally has no participants (only seekers)
    game.giveItem(players[1].id, 'clue')

    const participants = game.events.getEventParticipants('investigate')
    expect(participants.find(p => p.id === players[1].id)).toBeDefined()
  })

  it('clue not in participants when no clue held', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'citizen', 'citizen', 'citizen'])
    game.nextPhase() // DAY → NIGHT

    const participants = game.events.getEventParticipants('investigate')
    expect(participants.find(p => p.id === players[1].id)).toBeUndefined()
  })

  it('clue consumed when investigate event resolves', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'citizen', 'citizen', 'citizen'])
    game.nextPhase() // DAY → NIGHT

    const clueHolder = players[1]
    game.giveItem(clueHolder.id, 'clue')
    expect(clueHolder.hasItem('clue')).toBe(true)

    game.startEvent('investigate')
    game.recordSelection(clueHolder.id, players[2].id)
    game.resolveEvent('investigate')

    // _cleanupParticipants removes startsEvent items with uses > 0
    expect(clueHolder.hasItem('clue')).toBe(false)
  })
})

// ─── Hardened ─────────────────────────────────────────────────────────────────

describe('Hardened', () => {
  it('absorbs any kill on first trigger', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])

    const target = players[2]
    game.giveItem(target.id, 'hardened')

    const result = game.killPlayer(target.id, 'children')
    expect(result).toBe('barricaded')
    expect(target.isAlive).toBe(true)
  })

  it('hardened item removed after absorbing', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])

    const target = players[2]
    game.giveItem(target.id, 'hardened')
    game.killPlayer(target.id, 'children')

    expect(target.hasItem('hardened')).toBe(false)
  })

  it('second kill kills the player (no item)', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])

    const target = players[2]
    game.giveItem(target.id, 'hardened')
    game.killPlayer(target.id, 'children') // absorbed
    game.killPlayer(target.id, 'children') // second kill

    expect(target.isAlive).toBe(false)
  })

  it('hardened absorbs vigilante kill too', () => {
    const { game, players } = createTestGame(5)
    startGameWithRoles(game, ['elder', 'vigilante', 'detective', 'citizen', 'citizen'])

    const target = players[3]
    game.giveItem(target.id, 'hardened')

    const result = game.killPlayer(target.id, 'vigilante')
    expect(result).toBe('barricaded')
    expect(target.isAlive).toBe(true)
  })
})

// ─── Prospect ─────────────────────────────────────────────────────────────────

describe('Prospect', () => {
  it('cell kill on prospect → player joins cell (role changes to sleeper)', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])

    const target = players[2]
    game.giveItem(target.id, 'prospect')

    game.killPlayer(target.id, 'children')

    expect(target.isAlive).toBe(true)
    expect(target.role.id).toBe('child')
    expect(target.hasItem('prospect')).toBe(false)
  })

  it('non-cell kill does not trigger prospect', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])

    const target = players[2]
    game.giveItem(target.id, 'prospect')

    game.killPlayer(target.id, 'vigilante')

    expect(target.isAlive).toBe(false)
    expect(target.role.id).toBe('citizen') // unchanged
  })
})

// ─── Syringe ──────────────────────────────────────────────────────────────────

describe('Syringe', () => {
  it('syringe gives POISONED item to target', () => {
    const { game, players } = createTestGame(5)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen', 'citizen'])
    game.nextPhase() // DAY → NIGHT

    const user = players[2]
    const target = players[3]
    game.giveItem(user.id, 'syringe')

    game.startEvent('inject')
    game.recordSelection(user.id, target.id)
    game.resolveEvent('inject')

    expect(target.hasItem('poisoned')).toBe(true)
    expect(target.poisonedAt).toBe(game.dayCount)
  })

  it('syringe target dies at next night resolve', () => {
    const { game, players } = createTestGame(5)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen', 'citizen'])
    game.nextPhase() // DAY → NIGHT

    const user = players[2]
    const target = players[3]
    game.giveItem(user.id, 'syringe')

    game.startEvent('inject')
    game.recordSelection(user.id, target.id)
    game.resolveEvent('inject')

    game.nextPhase() // NIGHT → DAY (poison doesn't fire same day)
    expect(target.isAlive).toBe(true)

    game.nextPhase() // DAY → NIGHT (day 2)
    game.resolveAllEvents()

    expect(target.isAlive).toBe(false)
  })
})

// ─── Poisoned item ────────────────────────────────────────────────────────────

describe('Poisoned item', () => {
  it('_processPoisonDeaths fires on NIGHT resolveAllEvents', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])
    game.nextPhase() // DAY → NIGHT

    const target = players[2]
    game.giveItem(target.id, 'poisoned')
    target.poisonedAt = game.dayCount - 1 // previous day

    game.resolveAllEvents()

    expect(target.isAlive).toBe(false)
  })

  it('poison does not fire same day it was applied', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])
    game.nextPhase() // DAY → NIGHT

    const target = players[2]
    game.giveItem(target.id, 'poisoned')
    target.poisonedAt = game.dayCount // same day

    game.resolveAllEvents()

    expect(target.isAlive).toBe(true)
  })

  it('poisoned item removed after death', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])
    game.nextPhase() // DAY → NIGHT

    const target = players[2]
    game.giveItem(target.id, 'poisoned')
    target.poisonedAt = game.dayCount - 1

    game.resolveAllEvents()

    expect(target.hasItem('poisoned')).toBe(false)
  })
})

// ─── No Vote ──────────────────────────────────────────────────────────────────

describe('No Vote', () => {
  it('novote holder excluded from vote participants', () => {
    const { game, players } = createTestGame(5)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen', 'citizen'])

    const silenced = players[2]
    game.giveItem(silenced.id, 'novote')

    game.startEvent('vote')
    const instance = game.events.activeEvents.get('vote')
    expect(instance.participants.includes(silenced.id)).toBe(false)
  })

  it('players without novote can still vote', () => {
    const { game, players } = createTestGame(5)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen', 'citizen'])

    game.giveItem(players[2].id, 'novote')

    game.startEvent('vote')
    const instance = game.events.activeEvents.get('vote')
    expect(instance.participants.includes(players[1].id)).toBe(true)
  })
})

// ─── Coward ───────────────────────────────────────────────────────────────────

describe('Coward', () => {
  it('coward holder excluded from event participants', () => {
    const { game, players } = createTestGame(5)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen', 'citizen'])
    game.nextPhase() // DAY → NIGHT

    const coward = players[2]
    game.giveItem(coward.id, 'coward')

    // Coward cannot participate in any event (filtered out in getEventParticipants)
    const participants = game.events.getEventParticipants('suspect')
    expect(participants.find(p => p.id === coward.id)).toBeUndefined()
  })

  it('coward excluded from valid targets', () => {
    const { game, players } = createTestGame(6)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen', 'citizen', 'child'])
    game.nextPhase() // DAY → NIGHT

    const coward = players[2]
    game.giveItem(coward.id, 'coward')

    game.startEvent('kill')
    const instance = game.events.activeEvents.get('kill')
    const targets = instance.event.validTargets(players[0], game)
    expect(targets.find(t => t.id === coward.id)).toBeUndefined()
  })
})

// ─── Marked item ──────────────────────────────────────────────────────────────

describe('Marked item', () => {
  it('player with marked item appears CELL when investigated', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])
    game.nextPhase() // DAY → NIGHT

    const target = players[2] // nobody — normally NOT CELL
    game.giveItem(target.id, 'marked')

    game.startEvent('investigate')
    game.recordSelection(players[1].id, target.id)
    const result = game.resolveEvent('investigate')

    const inv = result.resolution.investigations.find(i => i.targetId === target.id)
    expect(inv.isEvil).toBe(true)
  })

  it('marked item does not change team membership', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])

    const target = players[2]
    game.giveItem(target.id, 'marked')

    expect(target.role.team).toBe('citizens')
  })
})

// ─── Warden ───────────────────────────────────────────────────────────────────

describe('Warden', () => {
  it('warden adds holder to jail event participants', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])
    game.nextPhase() // DAY → NIGHT

    // nobody at seat 3 gets warden — jail normally only has jailer role
    const wardenHolder = players[2]
    game.giveItem(wardenHolder.id, 'warden')

    const participants = game.events.getEventParticipants('jail')
    expect(participants.find(p => p.id === wardenHolder.id)).toBeDefined()
  })

  it('warden has unlimited uses (maxUses=-1)', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])
    game.nextPhase() // DAY → NIGHT

    const wardenHolder = players[2]
    game.giveItem(wardenHolder.id, 'warden')

    // Still in participants after resolve (permanent item)
    game.startEvent('jail')
    game.recordSelection(wardenHolder.id, players[3].id)
    game.resolveEvent('jail')

    game.nextPhase() // NIGHT → DAY
    game.nextPhase() // DAY → NIGHT

    const participants2 = game.events.getEventParticipants('jail')
    expect(participants2.find(p => p.id === wardenHolder.id)).toBeDefined()
  })
})
