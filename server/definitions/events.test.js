// server/definitions/events.test.js
// Pure function unit tests for event utility helpers.

import { describe, it, expect } from 'vitest'
import { tallyVotes, checkRunoff, getRunoffTargets, getTeamDisplayName } from './events.js'
import { getRole } from './roles.js'

// ─── tallyVotes ─────────────────────────────────────────────────────────────

describe('tallyVotes', () => {
  it('empty results → isEmpty true, maxVotes 0, empty frontrunners', () => {
    const result = tallyVotes({})
    expect(result.isEmpty).toBe(true)
    expect(result.maxVotes).toBe(0)
    expect(result.frontrunners).toEqual([])
  })

  it('all abstain (null values) → isEmpty true', () => {
    const result = tallyVotes({ '1': null, '2': null, '3': null })
    expect(result.isEmpty).toBe(true)
    expect(result.maxVotes).toBe(0)
  })

  it('unanimous vote → single frontrunner, maxVotes = voter count', () => {
    const result = tallyVotes({ '2': '1', '3': '1', '4': '1' })
    expect(result.isEmpty).toBe(false)
    expect(result.maxVotes).toBe(3)
    expect(result.frontrunners).toEqual(['1'])
  })

  it('two-way tie → two frontrunners with equal votes', () => {
    const result = tallyVotes({ '1': '2', '3': '2', '2': '4', '4': '4' })
    expect(result.frontrunners).toHaveLength(2)
    expect(result.frontrunners).toContain('2')
    expect(result.frontrunners).toContain('4')
    expect(result.maxVotes).toBe(2)
  })

  it('mixed votes + abstains → abstains excluded, correct winner', () => {
    const result = tallyVotes({ '1': null, '2': '3', '3': '3', '4': '5' })
    expect(result.frontrunners).toEqual(['3'])
    expect(result.maxVotes).toBe(2)
    expect(result.tally['5']).toBe(1)
    expect(result.tally['3']).toBe(2)
  })
})

// ─── checkRunoff ─────────────────────────────────────────────────────────────

describe('checkRunoff', () => {
  it('1 frontrunner → returns null (clear winner)', () => {
    expect(checkRunoff(['1'], { '1': 3 }, 0, 'vote')).toBeNull()
  })

  it('2 frontrunners, round 0 → returns runoff result', () => {
    const result = checkRunoff(['1', '2'], { '1': 2, '2': 2 }, 0, 'vote')
    expect(result).not.toBeNull()
    expect(result.runoff).toBe(true)
    expect(result.frontrunners).toEqual(['1', '2'])
  })

  it('2 frontrunners, round 1 → still returns runoff', () => {
    const result = checkRunoff(['1', '2'], { '1': 2, '2': 2 }, 1, 'vote')
    expect(result.runoff).toBe(true)
  })

  it('2 frontrunners, round 2 → deadlock (no resolution)', () => {
    const result = checkRunoff(['1', '2'], { '1': 2, '2': 2 }, 2, 'vote')
    expect(result.deadlock).toBe(true)
  })
})

// ─── getRunoffTargets ────────────────────────────────────────────────────────

describe('getRunoffTargets', () => {
  it('returns null if no active event', () => {
    const fakeGame = { activeEvents: new Map() }
    expect(getRunoffTargets('vote', fakeGame)).toBeNull()
  })

  it('returns null if event has no runoffCandidates', () => {
    const fakeGame = { activeEvents: new Map([['vote', { results: {} }]]) }
    expect(getRunoffTargets('vote', fakeGame)).toBeNull()
  })

  it('returns null if runoffCandidates is empty array', () => {
    const fakeGame = {
      activeEvents: new Map([['vote', { runoffCandidates: [] }]]),
    }
    expect(getRunoffTargets('vote', fakeGame)).toBeNull()
  })

  it('returns runoffCandidates when present', () => {
    const candidates = ['1', '3']
    const fakeGame = {
      activeEvents: new Map([['vote', { runoffCandidates: candidates }]]),
    }
    expect(getRunoffTargets('vote', fakeGame)).toBe(candidates)
  })
})

// ─── getTeamDisplayName ───────────────────────────────────────────────────────

describe('getTeamDisplayName', () => {
  it('village-team role → returns circle team string', () => {
    const seer = getRole('seer')
    const result = getTeamDisplayName(seer)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('werewolf-team role → returns cell team string', () => {
    const alpha = getRole('elder')
    const result = getTeamDisplayName(alpha)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('jester role → returns jester-specific string (different from neutral)', () => {
    const jester = getRole('trickster')
    const neutral = getRole('vigilante')
    const jesterStr = getTeamDisplayName(jester)
    const neutralStr = getTeamDisplayName(neutral)
    expect(jesterStr).not.toBe(neutralStr)
  })

  it('null role → returns fallback string', () => {
    const result = getTeamDisplayName(null)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})
