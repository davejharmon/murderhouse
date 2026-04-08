// server/mechanics/roles.mechanics.test.js
// Per-role core ability tests: each role has at least one pass and one failure-mode test.

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

// ─── Medic ────────────────────────────────────────────────────────────────────

describe('Medic — protect', () => {
  let game, players

  beforeEach(() => {
    ;({ game, players } = createTestGame(6))
    startGameWithRoles(game, ['elder', 'doctor', 'detective', 'citizen', 'citizen', 'child'])
    game.nextPhase() // DAY → NIGHT
  })

  it('protect sets isProtected on target', () => {
    const target = players[2] // seeker
    game.startEvent('protect')
    game.recordSelection(players[1].id, target.id) // medic protects seeker
    game.resolveEvent('protect')
    expect(target.isProtected).toBe(true)
  })

  it('protected player survives cell kill', () => {
    const target = players[2]
    game.startEvent('protect')
    game.recordSelection(players[1].id, target.id)
    game.resolveEvent('protect')

    game.startEvent('kill')
    game.recordSelection(players[0].id, target.id)
    const result = game.resolveEvent('kill')

    expect(result.resolution.outcome).toBe('protected')
    expect(target.isAlive).toBe(true)
  })

  it('protection is cleared after phase transition', () => {
    const target = players[2]
    game.startEvent('protect')
    game.recordSelection(players[1].id, target.id)
    game.resolveEvent('protect')
    expect(target.isProtected).toBe(true)

    game.nextPhase() // NIGHT → DAY
    expect(target.isProtected).toBe(false)
  })

  it('vote elimination ignores protection', () => {
    // Give protection to a player during night, then vote them out during day
    const target = players[2]
    game.startEvent('protect')
    game.recordSelection(players[1].id, target.id)
    game.resolveEvent('protect')

    game.nextPhase() // NIGHT → DAY
    // isProtected cleared by resetForPhase, so vote elimination should work
    game.startEvent('vote')
    for (const p of game.getAlivePlayers()) {
      if (p.id !== target.id) {
        game.recordSelection(p.id, target.id)
      }
    }
    game.resolveEvent('vote', { force: true })
    expect(target.isAlive).toBe(false)
  })
})

// ─── Seeker ───────────────────────────────────────────────────────────────────

describe('Seeker — investigate', () => {
  let game, players

  beforeEach(() => {
    ;({ game, players } = createTestGame(5))
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'marked', 'citizen'])
    game.nextPhase() // DAY → NIGHT
  })

  it('returns NOT CELL for circle member', () => {
    const seeker = players[1]
    const nobody = players[2]

    game.startEvent('investigate')
    game.recordSelection(seeker.id, nobody.id)
    const result = game.resolveEvent('investigate')

    const inv = result.resolution.investigations.find(i => i.seekerId === seeker.id)
    expect(inv.isEvil).toBe(false)
  })

  it('returns CELL for alpha', () => {
    const seeker = players[1]
    const alpha = players[0]

    game.startEvent('investigate')
    game.recordSelection(seeker.id, alpha.id)
    const result = game.resolveEvent('investigate')

    const inv = result.resolution.investigations.find(i => i.seekerId === seeker.id)
    expect(inv.isEvil).toBe(true)
  })

  it('returns CELL for Marked role (appearsGuilty)', () => {
    const seeker = players[1]
    const marked = players[3]

    expect(marked.role.id).toBe('marked')
    expect(marked.role.appearsGuilty).toBe(true)

    game.startEvent('investigate')
    game.recordSelection(seeker.id, marked.id)
    const result = game.resolveEvent('investigate')

    const inv = result.resolution.investigations.find(i => i.seekerId === seeker.id)
    expect(inv.isEvil).toBe(true)
  })

  it('returns CELL for player with marked item', () => {
    const seeker = players[1]
    const target = players[4] // nobody

    game.giveItem(target.id, 'marked')

    game.startEvent('investigate')
    game.recordSelection(seeker.id, target.id)
    const result = game.resolveEvent('investigate')

    const inv = result.resolution.investigations.find(i => i.seekerId === seeker.id)
    expect(inv.isEvil).toBe(true)
  })

  it('abstaining seeker produces no investigation record', () => {
    const seeker = players[1]

    game.startEvent('investigate')
    game.recordSelection(seeker.id, null) // abstain
    const result = game.resolveEvent('investigate')

    expect(result.resolution.silent).toBe(true)
    expect(result.resolution.investigations).toBeUndefined()
  })
})

// ─── Vigilante ────────────────────────────────────────────────────────────────

describe('Vigilante — vigil', () => {
  let game, players

  beforeEach(() => {
    ;({ game, players } = createTestGame(5))
    startGameWithRoles(game, ['elder', 'vigilante', 'doctor', 'citizen', 'citizen'])
    game.nextPhase() // DAY → NIGHT
  })

  it('night kill kills target', () => {
    const vigilante = players[1]
    const target = players[3]

    game.startEvent('vigil')
    game.recordSelection(vigilante.id, target.id)
    game.resolveEvent('vigil')

    expect(target.isAlive).toBe(false)
  })

  it('vigilanteUsed set to true after first use', () => {
    const vigilante = players[1]
    game.startEvent('vigil')
    game.recordSelection(vigilante.id, players[3].id)
    game.resolveEvent('vigil')

    expect(vigilante.vigilanteUsed).toBe(true)
  })

  it('vigilante not in participants after first use', () => {
    const vigilante = players[1]
    vigilante.vigilanteUsed = true

    // Advance to next night and check participants
    game.nextPhase() // NIGHT → DAY
    game.nextPhase() // DAY → NIGHT

    const participants = game.events.getEventParticipants('vigil')
    expect(participants.find(p => p.id === vigilante.id)).toBeUndefined()
  })

  it('protected target survives, protection consumed', () => {
    const vigilante = players[1]
    const medic = players[2]
    const target = players[3]

    game.startEvent('protect')
    game.recordSelection(medic.id, target.id)
    game.resolveEvent('protect')

    game.startEvent('vigil')
    game.recordSelection(vigilante.id, target.id)
    const result = game.resolveEvent('vigil')

    expect(result.resolution.outcome).toBe('protected')
    expect(target.isAlive).toBe(true)
    expect(target.isProtected).toBe(false) // consumed
  })
})

// ─── Handler — block ──────────────────────────────────────────────────────────

describe('Handler — block', () => {
  let game, players

  beforeEach(() => {
    ;({ game, players } = createTestGame(5))
    startGameWithRoles(game, ['elder', 'silent', 'detective', 'citizen', 'citizen'])
    game.nextPhase() // DAY → NIGHT
  })

  it('block sets isRoleblocked on target', () => {
    const handler = players[1]
    const target = players[2]

    game.startEvent('block')
    game.recordSelection(handler.id, target.id)
    game.resolveEvent('block')

    expect(target.isRoleblocked).toBe(true)
  })

  it('roleblocked alpha cannot kill (target nulled)', () => {
    const handler = players[1]
    const alpha = players[0]
    const target = players[3]

    // Block alpha first (priority 5 < kill priority 60)
    game.startEvent('block')
    game.recordSelection(handler.id, alpha.id)
    game.resolveEvent('block')

    expect(alpha.isRoleblocked).toBe(true)

    // Now start kill — roleblock should null out the selection
    game.startEvent('kill')
    game.recordSelection(alpha.id, target.id)
    game.resolveEvent('kill') // _applyRoleblocks nulls alpha's target

    expect(target.isAlive).toBe(true)
  })

  it('isRoleblocked cleared after phase transition', () => {
    const handler = players[1]
    const target = players[2]

    game.startEvent('block')
    game.recordSelection(handler.id, target.id)
    game.resolveEvent('block')
    expect(target.isRoleblocked).toBe(true)

    game.nextPhase() // NIGHT → DAY
    expect(target.isRoleblocked).toBe(false)
  })
})

// ─── Fixer — clean ────────────────────────────────────────────────────────────

describe('Fixer — clean', () => {
  let game, players

  beforeEach(() => {
    // 7 players: 2 cell (alpha, fixer) vs 5 circle — so killing one circle member
    // (2 vs 4) doesn't trigger cell win and call endGame (which resets isRoleCleaned)
    ;({ game, players } = createTestGame(7))
    startGameWithRoles(game, ['elder', 'hidden', 'detective', 'citizen', 'citizen', 'citizen', 'citizen'])
    game.nextPhase() // DAY → NIGHT
  })

  it('fixer YES sets game.fixerCovering', () => {
    const fixer = players[1]

    game.startEvent('clean')
    game.recordSelection(fixer.id, fixer.id) // self-target = YES
    game.resolveEvent('clean')

    expect(game.fixerCovering).toBe(true)
  })

  it('fixer NO leaves fixerCovering false', () => {
    const fixer = players[1]

    game.startEvent('clean')
    game.recordSelection(fixer.id, null) // abstain = NO
    game.resolveEvent('clean')

    expect(game.fixerCovering).toBe(false)
  })

  it('game.fixerCovering=true causes kill to mark isRoleCleaned', () => {
    // Set fixerCovering directly to isolate the kill event's behaviour
    const alpha = players[0]
    const target = players[3]

    game.fixerCovering = true

    game.startEvent('kill')
    game.recordSelection(alpha.id, target.id)
    game.resolveEvent('kill')

    expect(target.isRoleCleaned).toBe(true)
    expect(game.fixerCovering).toBe(false)
  })

  it('resolving clean then kill in resolveAllEvents marks isRoleCleaned', () => {
    const alpha = players[0]
    const fixer = players[1]
    const target = players[3]

    game.startEvent('clean')
    game.startEvent('kill')
    game.recordSelection(fixer.id, fixer.id)
    game.recordSelection(alpha.id, target.id)

    // Verify clean recorded in its event instance
    const cleanInst = game.events.activeEvents.get('clean')
    expect(cleanInst?.results[fixer.id]).toBe(fixer.id)

    game.resolveAllEvents()

    expect(target.isRoleCleaned).toBe(true)
  })

  it('kill without fixer does NOT mark isRoleCleaned', () => {
    const alpha = players[0]
    const target = players[3]

    game.startEvent('kill')
    game.recordSelection(alpha.id, target.id)
    game.resolveEvent('kill')

    expect(target.isRoleCleaned).toBe(false)
  })
})

// ─── Chemist — poison ─────────────────────────────────────────────────────────

describe('Chemist — poison (chemist replaces kill with delayed poison)', () => {
  let game, players

  beforeEach(() => {
    ;({ game, players } = createTestGame(5))
    startGameWithRoles(game, ['elder', 'bitter', 'detective', 'citizen', 'citizen'])
    game.nextPhase() // DAY → NIGHT
  })

  it('chemist YES sets game.chemistActing', () => {
    const chemist = players[1]

    game.startEvent('poison')
    game.recordSelection(chemist.id, chemist.id) // YES
    game.resolveEvent('poison')

    expect(game.chemistActing).toBe(true)
  })

  it('kill while chemistActing gives victim POISONED item instead of killing', () => {
    const alpha = players[0]
    const chemist = players[1]
    const target = players[3]

    game.startEvent('poison')
    game.recordSelection(chemist.id, chemist.id)
    game.resolveEvent('poison')

    game.startEvent('kill')
    game.recordSelection(alpha.id, target.id)
    const result = game.resolveEvent('kill')

    expect(result.resolution.outcome).toBe('poisoned')
    expect(target.isAlive).toBe(true)
    expect(target.hasItem('poisoned')).toBe(true)
  })

  it('poisoned player dies at next night resolve', () => {
    const alpha = players[0]
    const chemist = players[1]
    const target = players[3]

    game.startEvent('poison')
    game.recordSelection(chemist.id, chemist.id)
    game.resolveEvent('poison')
    game.startEvent('kill')
    game.recordSelection(alpha.id, target.id)
    game.resolveEvent('kill') // target gets POISONED item

    game.nextPhase() // NIGHT → DAY (poison doesn't fire yet — same day)
    expect(target.isAlive).toBe(true)

    game.nextPhase() // DAY → NIGHT
    game.resolveAllEvents() // _processPoisonDeaths fires here

    expect(target.isAlive).toBe(false)
  })

  it('medic protection on same night as poisoning prevents poison from being applied', () => {
    // Need a medic — create a separate 6-player game for this test
    const { game: g, players: ps } = createTestGame(6)
    startGameWithRoles(g, ['elder', 'bitter', 'doctor', 'detective', 'citizen', 'citizen'])
    g.nextPhase() // DAY → NIGHT

    const alpha = ps[0]
    const chemist = ps[1]
    const medic = ps[2]
    const target = ps[4]

    // Medic protects target on the same night chemist would poison them
    g.startEvent('protect')
    g.recordSelection(medic.id, target.id)
    g.resolveEvent('protect') // target.isProtected = true

    g.startEvent('poison')
    g.recordSelection(chemist.id, chemist.id)
    g.resolveEvent('poison') // sets chemistActing = true

    g.startEvent('kill')
    g.recordSelection(alpha.id, target.id)
    g.resolveEvent('kill') // chemistActing: isProtected check prevents poison

    expect(target.hasItem('poisoned')).toBe(false)
    expect(target.isAlive).toBe(true)
  })

  it('medic protection on a subsequent night does NOT cure poison', () => {
    // Need a medic — create a separate 6-player game for this test
    const { game: g, players: ps } = createTestGame(6)
    startGameWithRoles(g, ['elder', 'bitter', 'doctor', 'detective', 'citizen', 'citizen'])
    g.nextPhase() // DAY → NIGHT

    const alpha = ps[0]
    const chemist = ps[1]
    const medic = ps[2]
    const target = ps[4]

    // Night 1: chemist poisons target via kill event
    g.startEvent('poison')
    g.recordSelection(chemist.id, chemist.id)
    g.resolveEvent('poison')
    g.startEvent('kill')
    g.recordSelection(alpha.id, target.id)
    g.resolveEvent('kill') // target gets POISONED item instead of dying

    g.nextPhase() // NIGHT → DAY
    g.nextPhase() // DAY → NIGHT (day 2)

    // Night 2: medic protects target — protection has no effect on poison
    g.startEvent('protect')
    g.recordSelection(medic.id, target.id)
    g.resolveEvent('protect')

    g.resolveAllEvents() // _processPoisonDeaths fires — poison kills despite protection
    expect(target.isAlive).toBe(false)
  })
})

// ─── Jailer — jail ────────────────────────────────────────────────────────────

describe('Jailer — jail', () => {
  let game, players

  beforeEach(() => {
    ;({ game, players } = createTestGame(5))
    startGameWithRoles(game, ['elder', 'jailer', 'detective', 'citizen', 'citizen'])
    game.nextPhase() // DAY → NIGHT
  })

  it('jail sets both isProtected and isRoleblocked on target', () => {
    const jailer = players[1]
    const target = players[2]

    game.startEvent('jail')
    game.recordSelection(jailer.id, target.id)
    game.resolveEvent('jail')

    expect(target.isProtected).toBe(true)
    expect(target.isRoleblocked).toBe(true)
  })

  it('jailed target survives cell kill (protected)', () => {
    const jailer = players[1]
    const alpha = players[0]
    const target = players[3]

    game.startEvent('jail')
    game.recordSelection(jailer.id, target.id)
    game.resolveEvent('jail')

    game.startEvent('kill')
    game.recordSelection(alpha.id, target.id)
    game.resolveEvent('kill')

    expect(target.isAlive).toBe(true)
  })

  it('jailer cannot target themselves', () => {
    const jailer = players[1]
    const validTargets = game.events
      .getEventParticipants('jail')
      .flatMap(p => {
        const event = game.events.activeEvents.get('jail')
        return []
      })

    // Verify via the event definition's validTargets
    const jailEvent = game.events.activeEvents
    game.startEvent('jail')
    const instance = game.events.activeEvents.get('jail')
    const { event } = instance
    const targets = event.validTargets(jailer, game)

    expect(targets.find(t => t.id === jailer.id)).toBeUndefined()
  })
})

// ─── Amateur — stumble ────────────────────────────────────────────────────────

describe('Amateur — stumble', () => {
  let game, players

  beforeEach(() => {
    ;({ game, players } = createTestGame(5))
    startGameWithRoles(game, ['elder', 'wildcard', 'detective', 'citizen', 'citizen'])
    game.nextPhase() // DAY → NIGHT
  })

  it('stumble always reports NOT CELL in private message (non-investigate actions)', () => {
    // Amateur's private result always shows INNOCENT regardless of action
    const amateur = players[1]
    const alpha = players[0]

    // Run many iterations — result should always be NOT CELL unless action is investigate
    // For deterministic testing, override Math.random to force a non-investigate action
    const origRandom = Math.random
    Math.random = vi.fn(() => 0.34) // index 1 = 'kill' in DRUNK_ACTIONS array

    game.startEvent('stumble')
    game.recordSelection(amateur.id, alpha.id)
    const result = game.resolveEvent('stumble')

    Math.random = origRandom

    const inv = result.resolution.investigations?.find(i => i.seekerId === amateur.id)
    expect(inv.isEvil).toBe(false) // always INNOCENT for non-investigate actions
  })

  it('amateur appears as seeker (disguiseAs)', () => {
    const amateur = players[1]
    expect(amateur.role.id).toBe('wildcard')
    expect(amateur.role.disguiseAs.id).toBe('detective')
  })

  it('stumble event is in amateur participants', () => {
    const participants = game.events.getEventParticipants('stumble')
    expect(participants.find(p => p.id === players[1].id)).toBeDefined()
  })
})

// ─── Jester ───────────────────────────────────────────────────────────────────

describe('Jester — voted out', () => {
  it('jesterWon set on player when voted out (eliminated cause)', () => {
    const { game, players } = createTestGame(5)
    startGameWithRoles(game, ['elder', 'trickster', 'citizen', 'citizen', 'citizen'])

    const jester = players[1]

    // Vote jester out
    game.startEvent('vote')
    for (const p of game.getAlivePlayers()) {
      if (p.id !== jester.id) {
        game.recordSelection(p.id, jester.id)
      }
    }
    game.resolveEvent('vote', { force: true })

    expect(jester.jesterWon).toBe(true)
    expect(jester.isAlive).toBe(false)
  })

  it('jesterWon NOT set when killed by cell (not eliminated)', () => {
    const { game, players } = createTestGame(5)
    startGameWithRoles(game, ['elder', 'trickster', 'citizen', 'citizen', 'citizen'])

    const jester = players[1]
    game.killPlayer(jester.id, 'children')

    expect(jester.jesterWon).toBeFalsy()
  })
})

// ─── Cupid — heartbreak ───────────────────────────────────────────────────────

describe('Cupid — heartbreak (additional)', () => {
  it('killing one linked player kills the other', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])

    const p3 = players[2]
    const p4 = players[3]
    p3.linkedTo = p4.id
    p4.linkedTo = p3.id

    game.killPlayer(p3.id, 'children')

    expect(p3.isAlive).toBe(false)
    expect(p4.isAlive).toBe(false)
  })

  it('killing the other linked player also kills the first', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])

    const p3 = players[2]
    const p4 = players[3]
    p3.linkedTo = p4.id
    p4.linkedTo = p3.id

    game.killPlayer(p4.id, 'children')

    expect(p4.isAlive).toBe(false)
    expect(p3.isAlive).toBe(false)
  })

  it('unlinked player death does not cascade', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])

    game.killPlayer(players[2].id, 'children')

    expect(players[3].isAlive).toBe(true)
  })
})

// ─── Display state regressions ────────────────────────────────────────────────

describe('display state — pack hint line3 regression', () => {
  it('sleeper display has valid line3 when alpha has a kill selection (pack hint bug)', () => {
    // Regression: _getPackHint returned { left: '', center: 'NAME', right: '' } for a
    // sleeper when alpha had selected a kill target. TinyScreen crashed because
    // hasLine3Split = ('' || '') = false, falling into the else branch where
    // line3.text was undefined.
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'child', 'citizen', 'citizen'])
    game.nextPhase() // DAY → NIGHT

    const alpha = players[0]
    const sleeper = players[1]
    const target = players[2]

    // Alpha records a kill target — _getPackHint builds center from this
    game.startEvent('kill')
    game.recordSelection(alpha.id, target.id)

    const display = sleeper.getDisplayState(game)

    // line3 must be a valid object that TinyScreen can render:
    // either line3.text is a string OR at least one of left/center/right is truthy
    const { line3 } = display
    const hasValidLine3 =
      (typeof line3.text === 'string') ||
      line3.left || line3.center || line3.right

    expect(hasValidLine3).toBeTruthy()
  })

  it('alpha display has valid line3 when sleeper has a hunt suggestion', () => {
    // Symmetric case: alpha's pack hint reads sleeper suggestions from HUNT event
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'child', 'citizen', 'citizen'])
    game.nextPhase() // DAY → NIGHT

    const alpha = players[0]
    const sleeper = players[1]
    const target = players[2]

    game.startEvent('hunt')
    game.recordSelection(sleeper.id, target.id)

    const display = alpha.getDisplayState(game)
    const { line3 } = display
    const hasValidLine3 =
      (typeof line3.text === 'string') ||
      line3.left || line3.center || line3.right

    expect(hasValidLine3).toBeTruthy()
  })
})

