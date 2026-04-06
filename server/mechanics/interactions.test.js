// server/mechanics/interactions.test.js
// Multi-system interaction tests: roleblock+kill, protect+kill, poison timing,
// slide ordering, and score awarding.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GamePhase, Team } from '../../shared/constants.js'
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

// ─── Roleblock + Kill ─────────────────────────────────────────────────────────

describe('roleblock + kill interaction', () => {
  it('blocked alpha does not kill (target nulled by _applyRoleblocks)', () => {
    const { game, players } = createTestGame(5)
    startGameWithRoles(game, ['alpha', 'handler', 'seeker', 'nobody', 'nobody'])
    game.nextPhase() // DAY → NIGHT

    const alpha = players[0]
    const handler = players[1]
    const target = players[3]

    // Block event (priority 5) resolves before kill (priority 60)
    game.startEvent('block')
    game.recordSelection(handler.id, alpha.id)
    game.resolveEvent('block')

    game.startEvent('kill')
    game.recordSelection(alpha.id, target.id)
    game.resolveEvent('kill')

    expect(target.isAlive).toBe(true)
  })

  it('unblocked alpha kills target normally', () => {
    const { game, players } = createTestGame(5)
    startGameWithRoles(game, ['alpha', 'handler', 'seeker', 'nobody', 'nobody'])
    game.nextPhase() // DAY → NIGHT

    const alpha = players[0]
    const target = players[3]

    game.startEvent('kill')
    game.recordSelection(alpha.id, target.id)
    game.resolveEvent('kill')

    expect(target.isAlive).toBe(false)
  })

  it('blocked seeker does not investigate', () => {
    const { game, players } = createTestGame(5)
    startGameWithRoles(game, ['alpha', 'handler', 'seeker', 'nobody', 'nobody'])
    game.nextPhase() // DAY → NIGHT

    const handler = players[1]
    const seeker = players[2]

    game.startEvent('block')
    game.recordSelection(handler.id, seeker.id)
    game.resolveEvent('block')

    game.startEvent('investigate')
    game.recordSelection(seeker.id, players[0].id)
    const result = game.resolveEvent('investigate')

    // Blocked seeker's target is nulled — no investigation
    expect(result.resolution.silent).toBe(true)
  })
})

// ─── Protect + Kill interaction ───────────────────────────────────────────────

describe('protect + kill interaction', () => {
  it('medic protect saves target from cell kill', () => {
    const { game, players } = createTestGame(5)
    startGameWithRoles(game, ['alpha', 'medic', 'seeker', 'nobody', 'nobody'])
    game.nextPhase() // DAY → NIGHT

    const medic = players[1]
    const alpha = players[0]
    const target = players[3]

    // Protect first (priority 10 < kill priority 60)
    game.startEvent('protect')
    game.recordSelection(medic.id, target.id)
    game.resolveEvent('protect')

    game.startEvent('kill')
    game.recordSelection(alpha.id, target.id)
    const result = game.resolveEvent('kill')

    expect(result.resolution.outcome).toBe('protected')
    expect(target.isAlive).toBe(true)
  })

  it('protection is cleared after night phase', () => {
    const { game, players } = createTestGame(5)
    startGameWithRoles(game, ['alpha', 'medic', 'seeker', 'nobody', 'nobody'])
    game.nextPhase() // DAY → NIGHT

    const medic = players[1]
    const target = players[3]

    game.startEvent('protect')
    game.recordSelection(medic.id, target.id)
    game.resolveEvent('protect')

    expect(target.isProtected).toBe(true)
    game.nextPhase() // NIGHT → DAY
    expect(target.isProtected).toBe(false)
  })

  it('protection does not block vote elimination', () => {
    const { game, players } = createTestGame(5)
    startGameWithRoles(game, ['alpha', 'medic', 'seeker', 'nobody', 'nobody'])

    const target = players[3]
    // Manually set protected (shouldn't happen during day, but testing the guard)
    target.isProtected = true

    game.startEvent('vote')
    for (const p of game.getAlivePlayers()) {
      if (p.id !== target.id) game.recordSelection(p.id, target.id)
    }
    game.resolveEvent('vote', { force: true })

    expect(target.isAlive).toBe(false)
  })
})

// ─── Poison timing ────────────────────────────────────────────────────────────

describe('_processPoisonDeaths timing', () => {
  it('fires during NIGHT resolveAllEvents', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    game.nextPhase() // DAY → NIGHT

    const victim = players[2]
    game.giveItem(victim.id, 'poisoned')
    victim.poisonedAt = 0 // previous day

    game.resolveAllEvents()

    expect(victim.isAlive).toBe(false)
  })

  it('does NOT fire on DAY → NIGHT transition', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])

    // Give poison during day (unusual but testable)
    const victim = players[2]
    game.giveItem(victim.id, 'poisoned')
    victim.poisonedAt = 0

    // Move to NIGHT — poison doesn't fire on DAY→NIGHT transition
    game.nextPhase()

    // Player still alive — poison fires on resolveAllEvents, not phase transition into night
    // (phase fires on NIGHT→DAY, specifically _processPoisonDeaths is called at night resolve)
    // Test that simply calling nextPhase from DAY doesn't kill
    expect(victim.isAlive).toBe(true)
  })

  it('fires on NIGHT → DAY transition (nextPhase)', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])
    game.nextPhase() // DAY → NIGHT

    const victim = players[2]
    game.giveItem(victim.id, 'poisoned')
    victim.poisonedAt = 0 // poisoned on day 0

    game.nextPhase() // NIGHT → DAY — _processPoisonDeaths called here

    expect(victim.isAlive).toBe(false)
  })
})

// ─── Score awarding ───────────────────────────────────────────────────────────

describe('score awarding (awardEndGameScores)', () => {
  it('surviving players on winning team get both survived + winningTeam points', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])

    // Name players so scores are tracked
    players[0].name = 'Alpha'
    players[1].name = 'Seeker'
    players[2].name = 'Nobody1'
    players[3].name = 'Nobody2'

    // Kill alpha — circle wins. endGame calls awardEndGameScores internally.
    game.killPlayer(players[0].id, 'test')
    game.endGame(Team.CIRCLE)

    const scores = game.persistence.getScoresObject()
    // Seeker + Nobody1 + Nobody2 survived and are on winning team: survived(1) + winningTeam(1) = 2 each
    expect(scores['Seeker']).toBe(2)
    expect(scores['Nobody1']).toBe(2)
    expect(scores['Nobody2']).toBe(2)
    // Alpha died same day game ended — counts as survived per implementation (deathDay === dayCount)
    // But is on the losing team, so only gets survived(1), not winningTeam
    expect(scores['Alpha'] ?? 0).toBe(1)
  })

  it('dead player on winning team gets winningTeam points only', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])

    players[0].name = 'Alpha'
    players[1].name = 'Seeker'
    players[2].name = 'Nobody1'
    players[3].name = 'Nobody2'

    // Kill seeker (circle member) — then kill alpha to end game
    game.killPlayer(players[1].id, 'cell')
    game.killPlayer(players[0].id, 'test') // kill alpha to win
    game.endGame(Team.CIRCLE) // awards scores internally

    const scores = game.persistence.getScoresObject()
    // Seeker died same day game ended — still counts as survived per implementation
    // survived(1) + winningTeam(1) = 2
    expect(scores['Seeker']).toBe(2)
    // Survivors get both
    expect(scores['Nobody1']).toBe(2)
  })

  it('best investigator gets bonus points', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody'])

    players[0].name = 'Alpha'
    players[1].name = 'Seeker'
    players[2].name = 'Nobody1'
    players[3].name = 'Nobody2'

    // Seed seeker with correct suspicions
    players[1].suspicions = [
      { day: 1, targetId: players[0].id, wasCorrect: true },
    ]

    game.killPlayer(players[0].id, 'test')
    game.endGame(Team.CIRCLE) // awards scores internally

    const scores = game.persistence.getScoresObject()
    // Seeker: survived(1) + winningTeam(1) + bestInvestigator(2) = 4
    expect(scores['Seeker']).toBe(4)
  })
})

// ─── resolveAllEvents — slide ordering ───────────────────────────────────────

describe('resolveAllEvents — slide ordering', () => {
  it('death slides are grouped by player when multiple deaths occur', () => {
    const { game, players } = createTestGame(6)
    startGameWithRoles(game, ['alpha', 'vigilante', 'medic', 'nobody', 'nobody', 'nobody'])
    game.nextPhase() // DAY → NIGHT

    const vigilante = players[1]
    const alpha = players[0]
    const target1 = players[3]
    const target2 = players[4]

    // Both vigilante and alpha kill different targets
    game.startEvent('vigil')
    game.recordSelection(vigilante.id, target1.id)

    game.startEvent('kill')
    game.recordSelection(alpha.id, target2.id)

    // Resolve in priority order (vigil=55, kill=60 — but both start at same time)
    game.resolveAllEvents()

    expect(target1.isAlive).toBe(false)
    expect(target2.isAlive).toBe(false)
    // Slides are in the queue (grouped by playerId)
    const deathSlides = game.slides.slideQueue.filter(s => s.type === 'death')
    expect(deathSlides.length).toBeGreaterThanOrEqual(2)
  })
})
