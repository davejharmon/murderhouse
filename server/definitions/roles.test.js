// server/definitions/roles.test.js
// Structural validation and behavior tests for role definitions.

import { describe, it, expect } from 'vitest'
import { getRole, getAllRoles, GAME_COMPOSITION, buildRolePool } from './roles.js'
import { Team, RoleId } from '../../shared/constants.js'

const ALL_ROLES = Object.values(getAllRoles())
const VALID_TEAM_VALUES = new Set(Object.values(Team))

// ─── Structural validation ────────────────────────────────────────────────────

describe('role definitions — structural validation', () => {
  it('no duplicate role IDs', () => {
    const ids = ALL_ROLES.map((r) => r.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it.each(ALL_ROLES)('$id has required fields', (role) => {
    expect(typeof role.id).toBe('string')
    expect(role.id.length).toBeGreaterThan(0)
    expect(typeof role.name).toBe('string')
    expect(VALID_TEAM_VALUES.has(role.team)).toBe(true)
    expect(typeof role.description).toBe('string')
    expect(typeof role.color).toBe('string')
    expect(role.color).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(typeof role.emoji).toBe('string')
    expect(typeof role.events).toBe('object')
  })
})

// ─── getRole ─────────────────────────────────────────────────────────────────

describe('getRole', () => {
  it('returns role for valid id', () => {
    const role = getRole('alpha')
    expect(role).not.toBeNull()
    expect(role.id).toBe('alpha')
  })

  it('returns null for unknown id', () => {
    expect(getRole('nonexistent')).toBeNull()
  })
})

// ─── Role-specific passives ───────────────────────────────────────────────────

describe('alpha passives.onDeath', () => {
  it('with living sleeper → promotes to alpha, returns message', () => {
    const alpha = getRole('alpha')
    const sleeper = getRole('sleeper')
    const mockSleeper = {
      id: '2',
      isAlive: true,
      role: sleeper,
      assignRole: function (r) {
        this.role = r
      },
    }
    const fakeGame = {
      getAlivePlayers: () => [mockSleeper],
    }
    const result = alpha.passives.onDeath({ id: '1', role: alpha }, null, fakeGame)
    expect(result).not.toBeNull()
    expect(mockSleeper.role.id).toBe('alpha')
  })

  it('no living cell members → returns null', () => {
    const alpha = getRole('alpha')
    const fakeGame = {
      getAlivePlayers: () => [],
    }
    const result = alpha.passives.onDeath({ id: '1', role: alpha }, null, fakeGame)
    expect(result).toBeNull()
  })
})

describe('hunter passives.onDeath', () => {
  it('returns interrupt: true', () => {
    const hunter = getRole('hunter')
    expect(hunter.passives).toBeDefined()
    const result = hunter.passives.onDeath({ id: '1', role: hunter }, null, {})
    expect(result?.interrupt).toBe(true)
  })
})

describe('seeker role', () => {
  it('has investigate event', () => {
    const seeker = getRole('seeker')
    expect(seeker.events).toHaveProperty('investigate')
  })
})

// ─── GAME_COMPOSITION ────────────────────────────────────────────────────────

describe('GAME_COMPOSITION', () => {
  it('exists for player counts 4 through 10', () => {
    for (let n = 4; n <= 10; n++) {
      expect(GAME_COMPOSITION[n]).toBeDefined()
      expect(Array.isArray(GAME_COMPOSITION[n])).toBe(true)
    }
  })

  it('each composition length is less than or equal to its player count', () => {
    for (const [count, composition] of Object.entries(GAME_COMPOSITION)) {
      expect(composition.length).toBeLessThanOrEqual(Number(count))
    }
  })

  it('every entry references a valid role ID', () => {
    for (const composition of Object.values(GAME_COMPOSITION)) {
      for (const roleId of composition) {
        expect(getRole(roleId)).not.toBeNull()
      }
    }
  })

  it('every composition includes exactly 1 alpha', () => {
    for (const composition of Object.values(GAME_COMPOSITION)) {
      const alphaCount = composition.filter((id) => id === RoleId.ALPHA).length
      expect(alphaCount).toBe(1)
    }
  })
})

// ─── buildRolePool ────────────────────────────────────────────────────────────

describe('buildRolePool', () => {
  it('returns array of role IDs for valid player count', () => {
    const pool = buildRolePool(5)
    expect(Array.isArray(pool)).toBe(true)
    expect(pool.length).toBeGreaterThan(0)
    for (const id of pool) {
      expect(getRole(id)).not.toBeNull()
    }
  })
})
