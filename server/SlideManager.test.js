// server/SlideManager.test.js
// Isolated unit tests for SlideManager with mock game object.

import { describe, it, expect, beforeEach, vi } from 'vitest'
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

// ─── pushSlide ────────────────────────────────────────────────────────────────

describe('SlideManager.pushSlide', () => {
  it('adds a slide with a unique id', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])

    const before = game.slides.slideQueue.length
    game.slides.pushSlide({ type: 'title', title: 'Test' })
    expect(game.slides.slideQueue.length).toBe(before + 1)
    expect(game.slides.slideQueue.at(-1).id).toMatch(/^slide-\d+$/)
  })

  it('jumpTo=true updates currentSlideIndex to last slide', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])

    game.slides.pushSlide({ type: 'title', title: 'A' }, true)
    const idx = game.slides.currentSlideIndex
    game.slides.pushSlide({ type: 'title', title: 'B' }, true)

    expect(game.slides.currentSlideIndex).toBe(game.slides.slideQueue.length - 1)
  })

  it('jumpTo=false does not move currentSlideIndex', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])

    game.slides.pushSlide({ type: 'title', title: 'A' }, true)
    const idx = game.slides.currentSlideIndex

    game.slides.pushSlide({ type: 'title', title: 'B' }, false)
    expect(game.slides.currentSlideIndex).toBe(idx)
  })

  it('slide IDs are unique across multiple pushes', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])

    game.slides.pushSlide({ type: 'title', title: 'X' })
    game.slides.pushSlide({ type: 'title', title: 'Y' })
    game.slides.pushSlide({ type: 'title', title: 'Z' })

    const ids = game.slides.slideQueue.map(s => s.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})

// ─── nextSlide / prevSlide ────────────────────────────────────────────────────

describe('SlideManager navigation', () => {
  let game

  beforeEach(() => {
    ;({ game } = createTestGame(4))
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])
    game.slides.pushSlide({ type: 'title', title: 'A' })
    game.slides.pushSlide({ type: 'title', title: 'B' }, false)
    game.slides.pushSlide({ type: 'title', title: 'C' }, false)
    game.slides.currentSlideIndex = 0 // reset to first
  })

  it('nextSlide advances index', () => {
    game.slides.nextSlide()
    expect(game.slides.currentSlideIndex).toBe(1)
  })

  it('nextSlide does not advance past end', () => {
    game.slides.currentSlideIndex = game.slides.slideQueue.length - 1
    game.slides.nextSlide()
    expect(game.slides.currentSlideIndex).toBe(game.slides.slideQueue.length - 1)
  })

  it('prevSlide goes back', () => {
    game.slides.currentSlideIndex = 2
    game.slides.prevSlide()
    expect(game.slides.currentSlideIndex).toBe(1)
  })

  it('prevSlide does not go before 0', () => {
    game.slides.currentSlideIndex = 0
    game.slides.prevSlide()
    expect(game.slides.currentSlideIndex).toBe(0)
  })
})

// ─── getCurrentSlide ──────────────────────────────────────────────────────────

describe('SlideManager.getCurrentSlide', () => {
  it('returns null when queue is empty', () => {
    const { game } = createTestGame(0)
    game.slides.slideQueue = []
    game.slides.currentSlideIndex = -1
    expect(game.slides.getCurrentSlide()).toBeNull()
  })

  it('returns slide at currentSlideIndex', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])
    // Slide queue already has the DAY gallery slide from startGame.
    // Push two more and point to the second-to-last (the 'First' slide).
    game.slides.pushSlide({ type: 'title', title: 'First' }, false)
    game.slides.pushSlide({ type: 'title', title: 'Second' }, false)

    const firstIdx = game.slides.slideQueue.findIndex(s => s.title === 'First')
    game.slides.currentSlideIndex = firstIdx

    const slide = game.slides.getCurrentSlide()
    expect(slide.title).toBe('First')
  })
})

// ─── reset ────────────────────────────────────────────────────────────────────

describe('SlideManager.reset', () => {
  it('clears slideQueue and resets index', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])
    game.slides.pushSlide({ type: 'title', title: 'Existing' })

    game.slides.reset()

    expect(game.slides.slideQueue).toEqual([])
    expect(game.slides.currentSlideIndex).toBe(-1)
  })

  it('does not reset slideIdCounter (IDs unique across lifetime)', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])

    game.slides.pushSlide({ type: 'title', title: 'Before' })
    const counterBefore = game.slides.slideIdCounter

    game.slides.reset()
    game.slides.pushSlide({ type: 'title', title: 'After' })

    expect(game.slides.slideIdCounter).toBeGreaterThan(counterBefore)
  })
})

// ─── clearSlides ──────────────────────────────────────────────────────────────

describe('SlideManager.clearSlides', () => {
  it('clears queue and pushes a gallery slide for DAY phase', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])
    // Game starts in DAY
    game.slides.clearSlides()

    expect(game.slides.slideQueue.length).toBe(1)
    expect(game.slides.slideQueue[0].type).toBe('gallery')
  })

  it('clears queue and pushes gallery for NIGHT phase', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])
    game.nextPhase() // DAY → NIGHT
    game.slides.clearSlides()

    expect(game.slides.slideQueue.length).toBe(1)
    expect(game.slides.slideQueue[0].type).toBe('gallery')
  })
})

// ─── queueDeathSlide ──────────────────────────────────────────────────────────

describe('SlideManager.queueDeathSlide', () => {
  it('pushes two slides: identity then role reveal', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])

    const queueBefore = game.slides.slideQueue.length
    const victim = players[2]
    game.slides.queueDeathSlide({
      type: 'death',
      playerId: victim.id,
      title: 'CIRCLE KILLED',
      subtitle: victim.name,
      revealRole: true,
      style: 'hostile',
    })

    expect(game.slides.slideQueue.length).toBe(queueBefore + 2)

    const identity = game.slides.slideQueue[queueBefore]
    const reveal = game.slides.slideQueue[queueBefore + 1]

    expect(identity.revealRole).toBe(false)
    expect(reveal.revealRole).toBe(true)
  })

  it('identity slide uses victim name in title', () => {
    const { game, players } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])

    const victim = players[2]
    victim.name = 'Alice'
    const queueBefore = game.slides.slideQueue.length

    game.slides.queueDeathSlide({
      type: 'death',
      playerId: victim.id,
      title: 'CIRCLE KILLED',
      subtitle: victim.name,
      revealRole: true,
      style: 'hostile',
    })

    const identity = game.slides.slideQueue[queueBefore]
    expect(identity.title).toContain('ALICE')
  })
})

// ─── pushCompSlide ────────────────────────────────────────────────────────────

describe('SlideManager.pushCompSlide', () => {
  it('returns error when no roles assigned', () => {
    const { game } = createTestGame(4)
    // No roles assigned yet (lobby)
    const result = game.slides.pushCompSlide()
    expect(result.success).toBe(false)
  })

  it('returns success after roles assigned', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])
    const result = game.slides.pushCompSlide()
    expect(result.success).toBe(true)
  })

  it('pushes a composition-type slide', () => {
    const { game } = createTestGame(4)
    startGameWithRoles(game, ['elder', 'detective', 'citizen', 'citizen'])
    const before = game.slides.slideQueue.length
    game.slides.pushCompSlide()
    const slide = game.slides.slideQueue[before]
    expect(slide.type).toBe('composition')
  })
})
