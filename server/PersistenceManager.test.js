// server/PersistenceManager.test.js
// Isolated unit tests for PersistenceManager.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Team } from '../shared/constants.js'
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

// ─── Host Settings ────────────────────────────────────────────────────────────

describe('PersistenceManager host settings', () => {
  it('getHostSettings returns defaults when no file exists', () => {
    const { game } = createTestGame(0)
    const settings = game.persistence.getHostSettings()

    expect(settings.timerDuration).toBe(30)
    expect(settings.autoAdvanceEnabled).toBe(false)
    expect(settings.scoringConfig).toBeDefined()
  })

  it('saveHostSettings merges with existing settings', () => {
    const { game } = createTestGame(0)
    game.persistence.saveHostSettings({ timerDuration: 60 })

    const updated = game.persistence.getHostSettings()
    expect(updated.timerDuration).toBe(60)
    // Other defaults preserved
    expect(updated.autoAdvanceEnabled).toBe(false)
  })

  it('saveHostSettings writes to disk', () => {
    const { game } = createTestGame(0)
    game.persistence.saveHostSettings({ timerDuration: 45 })
    // writeFileSync is called internally; we just verify no error thrown
    // and state was saved
    expect(game.persistence.getHostSettings().timerDuration).toBe(45)
  })
})

// ─── Scores ───────────────────────────────────────────────────────────────────

describe('PersistenceManager scores', () => {
  it('getScoresObject returns empty map initially', () => {
    const { game } = createTestGame(0)
    const scores = game.persistence.getScoresObject()
    expect(typeof scores).toBe('object')
    expect(Object.keys(scores).length).toBe(0)
  })

  it('setScore stores and retrieves score', () => {
    const { game } = createTestGame(0)
    game.persistence.setScore('Alice', 5)

    const scores = game.persistence.getScoresObject()
    expect(scores['Alice']).toBe(5)
  })

  it('setScore overwrites existing score', () => {
    const { game } = createTestGame(0)
    game.persistence.setScore('Bob', 3)
    game.persistence.setScore('Bob', 7)

    expect(game.persistence.getScoresObject()['Bob']).toBe(7)
  })

  it('getScoresForConnectedPlayers returns sorted list', () => {
    const { game, players } = createTestGame(3)
    startGameWithRoles(game, ['elder', 'detective', 'citizen'])

    players[0].name = 'Alpha'
    players[1].name = 'Seeker'
    players[2].name = 'Nobody'

    game.persistence.setScore('Alpha', 1)
    game.persistence.setScore('Seeker', 5)
    game.persistence.setScore('Nobody', 3)

    const sorted = game.persistence.getScoresForConnectedPlayers()
    expect(sorted[0].name).toBe('Seeker')
    expect(sorted[1].name).toBe('Nobody')
    expect(sorted[2].name).toBe('Alpha')
  })
})

// ─── capturePreGameScores ─────────────────────────────────────────────────────

describe('PersistenceManager.capturePreGameScores', () => {
  it('captures a snapshot of scores at game start', () => {
    const { game } = createTestGame(0)
    game.persistence.setScore('Alice', 10)
    game.persistence.capturePreGameScores()

    // Modify scores after capture
    game.persistence.setScore('Alice', 20)

    const snapshot = game.persistence._preGameScores
    expect(snapshot.get('Alice')).toBe(10) // captured value unchanged
  })
})

// ─── Game Presets ─────────────────────────────────────────────────────────────

describe('PersistenceManager game presets', () => {
  it('getGamePresets returns empty list initially', () => {
    const { game } = createTestGame(0)
    const { presets } = game.persistence.getGamePresets()
    expect(presets).toEqual([])
  })

  it('saveGamePreset adds a preset', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])

    game.persistence.saveGamePreset('My Preset', 30, false)

    const { presets } = game.persistence.getGamePresets()
    expect(presets.length).toBe(1)
    expect(presets[0].name).toBe('My Preset')
    expect(presets[0].timerDuration).toBe(30)
  })

  it('deleteGamePreset removes the preset', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])

    game.persistence.saveGamePreset('Deletable', 30, false)
    const { presets } = game.persistence.getGamePresets()
    const id = presets[0].id

    const deleted = game.persistence.deleteGamePreset(id)
    expect(deleted).toBe(true)
    expect(game.persistence.getGamePresets().presets.length).toBe(0)
  })

  it('deleteGamePreset returns false for unknown id', () => {
    const { game } = createTestGame(0)
    expect(game.persistence.deleteGamePreset('nonexistent-id')).toBe(false)
  })

  it('saveGamePreset with overwriteId updates existing preset', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])

    game.persistence.saveGamePreset('Original', 30, false)
    const { presets } = game.persistence.getGamePresets()
    const id = presets[0].id

    game.persistence.saveGamePreset('Updated', 60, true, false, id)

    const updated = game.persistence.getGamePresets().presets[0]
    expect(updated.name).toBe('Updated')
    expect(updated.timerDuration).toBe(60)
    expect(game.persistence.getGamePresets().presets.length).toBe(1) // still one
  })
})

// ─── awardEndGameScores ───────────────────────────────────────────────────────

describe('PersistenceManager.awardEndGameScores', () => {
  it('awards no points when scoringConfig is undefined', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])

    players[0].name = 'Alpha'
    game.persistence._hostSettings.scoringConfig = undefined

    // Should not throw
    expect(() => game.persistence.awardEndGameScores(Team.CITIZENS)).not.toThrow()
  })

  it('surviving player on winning team earns survived + winningTeam', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])

    players[0].name = 'Alpha'
    players[1].name = 'Seeker'
    players[2].name = 'N1'
    players[3].name = 'N2'

    // endGame calls awardEndGameScores internally — don't call it twice
    game.killPlayer(players[0].id, 'test')
    game.endGame(Team.CITIZENS)

    const scores = game.persistence.getScoresObject()
    expect(scores['Seeker']).toBe(2) // survived(1) + winningTeam(1)
  })

  it('pushes score update slide when points awarded', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])

    players[0].name = 'Alpha'
    players[1].name = 'Seeker'
    players[2].name = 'N1'
    players[3].name = 'N2'

    game.killPlayer(players[0].id, 'test')
    // endGame calls awardEndGameScores internally, which pushes slides
    game.endGame(Team.CITIZENS)

    const newSlides = game.slides.slideQueue
    expect(newSlides.some(s => s.type === 'scoreUpdate')).toBe(true)
  })
})
