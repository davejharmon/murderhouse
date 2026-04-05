// server/flows/flows.test.js
// Integration tests for HunterRevengeFlow and GovernorPardonFlow.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTestGame, startGameWithRoles } from '../test/helpers.js'
import { ItemId } from '../../shared/constants.js'

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

// ─── HunterRevengeFlow ────────────────────────────────────────────────────────

describe('HunterRevengeFlow', () => {
  let game

  beforeEach(() => {
    ;({ game } = createTestGame(5))
    startGameWithRoles(game, ['alpha', 'sleeper', 'hunter', 'nobody', 'nobody'])
  })

  describe('canTrigger', () => {
    it('hunter death with interrupt: true → true', () => {
      const hunterFlow = game.flows.get('hunterRevenge')
      const hunter = game.getPlayer('3')
      const ctx = { player: hunter, cause: 'test', deathResult: { interrupt: true } }
      expect(hunterFlow.canTrigger(ctx)).toBe(true)
    })

    it('non-hunter death → false', () => {
      const hunterFlow = game.flows.get('hunterRevenge')
      const villager = game.getPlayer('4')
      const ctx = { player: villager, cause: 'test', deathResult: { interrupt: true } }
      expect(hunterFlow.canTrigger(ctx)).toBe(false)
    })

    it('hunter death without interrupt → false', () => {
      const hunterFlow = game.flows.get('hunterRevenge')
      const hunter = game.getPlayer('3')
      const ctx = { player: hunter, cause: 'test', deathResult: {} }
      expect(hunterFlow.canTrigger(ctx)).toBe(false)
    })
  })

  describe('trigger', () => {
    it('killing hunter activates revenge flow', () => {
      game.killPlayer('3', 'werewolf')
      const hunterFlow = game.flows.get('hunterRevenge')
      expect(hunterFlow.phase).toBe('active')
    })

    it('revenge flow has correct hunterId', () => {
      game.killPlayer('3', 'werewolf')
      const hunterFlow = game.flows.get('hunterRevenge')
      expect(hunterFlow.state?.hunterId).toBe('3')
    })

    it('creates hunterRevenge event in activeEvents', () => {
      game.killPlayer('3', 'werewolf')
      expect(game.activeEvents.has('hunterRevenge')).toBe(true)
    })
  })

  describe('getValidTargets', () => {
    it('returns all alive players except the hunter', () => {
      game.killPlayer('3', 'werewolf')
      const hunterFlow = game.flows.get('hunterRevenge')
      const targets = hunterFlow.getValidTargets('3')
      expect(targets.length).toBeGreaterThan(0)
      expect(targets.find((t) => t.id === '3')).toBeUndefined()
    })

    it('returns empty for non-hunter player', () => {
      game.killPlayer('3', 'werewolf')
      const hunterFlow = game.flows.get('hunterRevenge')
      expect(hunterFlow.getValidTargets('4')).toHaveLength(0)
    })
  })

  describe('onSelection', () => {
    it('valid target → kills target (via game.recordSelection)', () => {
      game.killPlayer('3', 'werewolf')
      const hunterFlow = game.flows.get('hunterRevenge')
      const targets = hunterFlow.getValidTargets('3')
      const target = targets[0]
      game.recordSelection('3', target.id)
      expect(game.getPlayer(target.id).isAlive).toBe(false)
    })

    it('null target (abstain) → returns error (direct call)', () => {
      game.killPlayer('3', 'werewolf')
      const hunterFlow = game.flows.get('hunterRevenge')
      const result = hunterFlow.onSelection('3', null)
      expect(result.error).toBeDefined()
    })

    it('invalid target id → returns error (direct call)', () => {
      game.killPlayer('3', 'werewolf')
      const hunterFlow = game.flows.get('hunterRevenge')
      const result = hunterFlow.onSelection('3', 'nonexistent')
      expect(result.error).toBeDefined()
    })
  })

  describe('cleanup', () => {
    it('after resolve: flow returns to idle, event removed', () => {
      game.killPlayer('3', 'werewolf')
      const hunterFlow = game.flows.get('hunterRevenge')
      const targets = hunterFlow.getValidTargets('3')
      game.recordSelection('3', targets[0].id)
      expect(hunterFlow.phase).toBe('idle')
      expect(game.activeEvents.has('hunterRevenge')).toBe(false)
    })
  })
})

// ─── GovernorPardonFlow ───────────────────────────────────────────────────────

describe('GovernorPardonFlow', () => {
  let game

  beforeEach(() => {
    ;({ game } = createTestGame(5))
    // 'judge' is the internal role ID (displays as Governor)
    startGameWithRoles(game, ['alpha', 'seeker', 'judge', 'nobody', 'nobody'])
  })

  function setupVoteForElimination(targetId = '1') {
    game.nextPhase() // move to night just to ensure vote can start... actually vote is DAY
    // Ensure we're in DAY and start vote
    game.startEvent('vote')
    for (const p of game.getAlivePlayers()) {
      if (p.id !== targetId) {
        game.recordSelection(p.id, targetId)
      } else {
        game.recordSelection(p.id, null) // target abstains
      }
    }
  }

  describe('canTrigger', () => {
    it('vote elimination with living judge → true', () => {
      const pardonFlow = game.flows.get('pardon')
      const alpha = game.getPlayer('1')
      const resolution = { outcome: 'eliminated', victim: alpha }
      expect(pardonFlow.canTrigger({ resolution })).toBe(true)
    })

    it('vote with outcome !== eliminated → false', () => {
      const pardonFlow = game.flows.get('pardon')
      const resolution = { outcome: 'no-kill', victim: null }
      expect(pardonFlow.canTrigger({ resolution })).toBe(false)
    })

    it('vote with no victim → false', () => {
      const pardonFlow = game.flows.get('pardon')
      const resolution = { outcome: 'eliminated', victim: null }
      expect(pardonFlow.canTrigger({ resolution })).toBe(false)
    })

    it('vote elimination with no judge alive → false', () => {
      // Kill the judge first
      game.killPlayer('3', 'test')
      const pardonFlow = game.flows.get('pardon')
      const alpha = game.getPlayer('1')
      const resolution = { outcome: 'eliminated', victim: alpha }
      expect(pardonFlow.canTrigger({ resolution })).toBe(false)
    })
  })

  describe('trigger — full vote → pardon flow', () => {
    it('resolving a majority vote with judge alive → awaitingPardon', () => {
      setupVoteForElimination('1')
      const result = game.resolveEvent('vote')
      expect(result.success).toBe(true)
      expect(result.awaitingPardon).toBe(true)
    })

    it('pardon flow is active after trigger', () => {
      setupVoteForElimination('1')
      game.resolveEvent('vote')
      const pardonFlow = game.flows.get('pardon')
      expect(pardonFlow.phase).toBe('active')
    })

    it('state has condemnedId and judgeIds', () => {
      setupVoteForElimination('1')
      game.resolveEvent('vote')
      const pardonFlow = game.flows.get('pardon')
      expect(pardonFlow.state.condemnedId).toBe('1')
      expect(pardonFlow.state.judgeIds).toContain('3')
    })
  })

  describe('getValidTargets', () => {
    beforeEach(() => {
      setupVoteForElimination('1')
      game.resolveEvent('vote')
    })

    it('returns [condemned] for eligible judge', () => {
      const pardonFlow = game.flows.get('pardon')
      const targets = pardonFlow.getValidTargets('3')
      expect(targets).toHaveLength(1)
      expect(targets[0].id).toBe('1')
    })

    it('returns [] for non-judge player', () => {
      const pardonFlow = game.flows.get('pardon')
      expect(pardonFlow.getValidTargets('4')).toHaveLength(0)
    })

    it('returns [] if judge IS the condemned player', () => {
      // Reset with judge as potential condemned
      ;({ game } = createTestGame(5))
      startGameWithRoles(game, ['alpha', 'seeker', 'judge', 'nobody', 'nobody'])
      game.startEvent('vote')
      // Everyone votes for judge (player 3)
      for (const p of game.getAlivePlayers()) {
        if (p.id !== '3') game.recordSelection(p.id, '3')
        else game.recordSelection(p.id, null)
      }
      game.resolveEvent('vote')
      const pardonFlow = game.flows.get('pardon')
      // Judge cannot pardon themselves
      expect(pardonFlow.getValidTargets('3')).toHaveLength(0)
    })
  })

  describe('pardon path', () => {
    beforeEach(() => {
      setupVoteForElimination('1')
      game.resolveEvent('vote')
    })

    it('judge selects condemned → condemned stays alive', () => {
      game.recordSelection('3', '1') // judge pardons
      expect(game.getPlayer('1').isAlive).toBe(true)
    })

    it('flow returns to idle after pardon', () => {
      game.recordSelection('3', '1')
      expect(game.flows.get('pardon').phase).toBe('idle')
    })
  })

  describe('execution path', () => {
    beforeEach(() => {
      setupVoteForElimination('1')
      game.resolveEvent('vote')
    })

    it('judge abstains → condemned is killed', () => {
      game.recordSelection('3', null) // judge abstains = execute
      expect(game.getPlayer('1').isAlive).toBe(false)
    })

    it('flow returns to idle after execution', () => {
      game.recordSelection('3', null)
      expect(game.flows.get('pardon').phase).toBe('idle')
    })
  })

  describe('gavel item', () => {
    it('gavel holder can trigger pardon flow', () => {
      ;({ game } = createTestGame(5))
      startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody', 'nobody'])
      game.giveItem('3', ItemId.GAVEL)
      const pardonFlow = game.flows.get('pardon')
      const alpha = game.getPlayer('1')
      const resolution = { outcome: 'eliminated', victim: alpha }
      expect(pardonFlow.canTrigger({ resolution })).toBe(true)
    })

    it('gavel is consumed after pardon', () => {
      ;({ game } = createTestGame(5))
      startGameWithRoles(game, ['alpha', 'seeker', 'nobody', 'nobody', 'nobody'])
      game.giveItem('3', ItemId.GAVEL)
      game.startEvent('vote')
      // Everyone votes for player 1
      for (const p of game.getAlivePlayers()) {
        game.recordSelection(p.id, p.id === '1' ? null : '1')
      }
      game.resolveEvent('vote')
      // Judge (player 3) pardons condemned (player 1) via game
      game.recordSelection('3', '1')
      const gavel = game.getPlayer('3').getItem(ItemId.GAVEL)
      // Gavel should be removed (null) or have 0 uses after being consumed
      expect(gavel === null || gavel.uses === 0).toBe(true)
    })
  })
})
