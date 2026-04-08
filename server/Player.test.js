// server/Player.test.js
// Unit tests for the Player model.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Player, resetSeatCounter } from './Player.js'
import { getRole } from './definitions/roles.js'
import { getItem } from './definitions/items.js'
import { PlayerStatus } from '../shared/constants.js'

beforeEach(() => {
  resetSeatCounter()
})

// ─── constructor ──────────────────────────────────────────────────────────────

describe('Player constructor', () => {
  it('numeric id sets matching seatNumber', () => {
    const p = new Player('5')
    expect(p.seatNumber).toBe(5)
  })

  it('default name is Player {seatNumber}', () => {
    const p = new Player('3')
    expect(p.name).toBe('Player 3')
  })

  it('default status is ALIVE', () => {
    const p = new Player('1')
    expect(p.status).toBe(PlayerStatus.ALIVE)
    expect(p.isAlive).toBe(true)
  })

  it('role is null, inventory empty, pendingEvents empty', () => {
    const p = new Player('1')
    expect(p.role).toBeNull()
    expect(p.inventory).toHaveLength(0)
    expect(p.pendingEvents.size).toBe(0)
  })
})

// ─── kill / revive ────────────────────────────────────────────────────────────

describe('kill / revive', () => {
  it('kill sets status to DEAD', () => {
    const p = new Player('1')
    p.kill('test')
    expect(p.status).toBe(PlayerStatus.DEAD)
    expect(p.isAlive).toBe(false)
  })

  it('kill records deathCause', () => {
    const p = new Player('1')
    p.kill('werewolf')
    expect(p.deathCause).toBe('werewolf')
  })

  it('revive sets status back to ALIVE', () => {
    const p = new Player('1')
    p.kill('test')
    p.revive()
    expect(p.status).toBe(PlayerStatus.ALIVE)
    expect(p.isAlive).toBe(true)
  })

  it('revive clears deathCause', () => {
    const p = new Player('1')
    p.kill('test')
    p.revive()
    expect(p.deathCause).toBeNull()
  })
})

// ─── reset ────────────────────────────────────────────────────────────────────

describe('reset', () => {
  it('clears role and inventory', () => {
    const p = new Player('1')
    p.assignRole(getRole('detective'))
    p.addItem(getItem('clue'))
    p.reset()
    expect(p.role).toBeNull()
    expect(p.inventory).toHaveLength(0)
  })

  it('status back to ALIVE after reset', () => {
    const p = new Player('1')
    p.kill('test')
    p.reset()
    expect(p.isAlive).toBe(true)
  })

  it('clears pendingEvents and currentSelection', () => {
    const p = new Player('1')
    p.pendingEvents.add('vote')
    p.currentSelection = '2'
    p.reset()
    expect(p.pendingEvents.size).toBe(0)
    expect(p.currentSelection).toBeNull()
  })
})

// ─── selection lifecycle ──────────────────────────────────────────────────────

describe('selection lifecycle', () => {
  it('confirmSelection returns and clears currentSelection', () => {
    const p = new Player('1')
    p.currentSelection = '3'
    const sel = p.confirmSelection()
    expect(sel).toBe('3')
    expect(p.currentSelection).toBeNull()
  })

  it('confirmSelection with no currentSelection → returns null', () => {
    const p = new Player('1')
    const sel = p.confirmSelection()
    expect(sel).toBeNull()
  })

  it('abstain clears currentSelection', () => {
    const p = new Player('1')
    p.currentSelection = '2'
    p.abstain()
    expect(p.currentSelection).toBeNull()
  })

  it('clearSelection resets currentSelection', () => {
    const p = new Player('1')
    p.currentSelection = '3'
    p.clearSelection()
    expect(p.currentSelection).toBeNull()
  })

  it('clearFromEvent removes event from pendingEvents and clears selection', () => {
    const p = new Player('1')
    p.pendingEvents.add('vote')
    p.currentSelection = '2'
    p.clearFromEvent('vote')
    expect(p.pendingEvents.has('vote')).toBe(false)
    expect(p.currentSelection).toBeNull()
  })
})

// ─── item management ─────────────────────────────────────────────────────────

describe('item management', () => {
  let player

  beforeEach(() => {
    player = new Player('1')
  })

  it('addItem adds item to inventory', () => {
    player.addItem(getItem('clue'))
    expect(player.hasItem('clue')).toBe(true)
    expect(player.inventory).toHaveLength(1)
  })

  it('addItem same item twice stacks uses, no duplicate entry', () => {
    player.addItem(getItem('clue'))
    const usesBefore = player.getItem('clue').uses
    player.addItem(getItem('clue'))
    expect(player.inventory.filter((i) => i.id === 'clue')).toHaveLength(1)
    expect(player.getItem('clue').uses).toBeGreaterThan(usesBefore)
  })

  it('hasItem returns false for missing item', () => {
    expect(player.hasItem('pistol')).toBe(false)
  })

  it('getItem returns null for missing item', () => {
    expect(player.getItem('pistol')).toBeNull()
  })

  it('removeItem removes from inventory and returns true', () => {
    player.addItem(getItem('clue'))
    const removed = player.removeItem('clue')
    expect(removed).toBe(true)
    expect(player.hasItem('clue')).toBe(false)
  })

  it('removeItem returns false for non-existent item', () => {
    expect(player.removeItem('pistol')).toBe(false)
  })
})

// ─── connection management ────────────────────────────────────────────────────

describe('connection management', () => {
  it('addConnection marks player as connected', () => {
    const p = new Player('1')
    const ws = { readyState: 1, send: vi.fn() }
    p.addConnection(ws)
    expect(p.connected).toBe(true)
  })

  it('removeConnection leaves player disconnected', () => {
    const p = new Player('1')
    const ws = { readyState: 1, send: vi.fn() }
    p.addConnection(ws)
    p.removeConnection(ws)
    expect(p.connected).toBe(false)
  })

  it('connected false when no connections', () => {
    const p = new Player('1')
    expect(p.connected).toBe(false)
  })
})
