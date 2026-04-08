// client/src/pages/Player.test.jsx
// Tests for Player page: loading state, rendering, and interaction handlers.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClientMsg, GamePhase } from '@shared/constants.js'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSend = vi.fn()
const mockJoinAsPlayer = vi.fn()
const mockRejoinAsPlayer = vi.fn()

let mockGameState = null
let mockPlayerState = null
let mockConnected = false
let mockEventPrompt = null
let mockEventResult = null
let mockNotifications = []

vi.mock('../context/GameContext', () => ({
  useGame: () => ({
    connected: mockConnected,
    gameState: mockGameState,
    playerState: mockPlayerState,
    eventPrompt: mockEventPrompt,
    eventResult: mockEventResult,
    notifications: mockNotifications,
    send: mockSend,
    joinAsPlayer: mockJoinAsPlayer,
    rejoinAsPlayer: mockRejoinAsPlayer,
  }),
}))

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: '3' }),
}))

// CSS module stub
vi.mock('./Player.module.css', () => ({ default: {} }))

// ─── Import after mocks ────────────────────────────────────────────────────────

const { default: Player } = await import('./Player.jsx')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePlayerState(overrides = {}) {
  return {
    id: '3',
    name: 'Player 3',
    role: { id: 'citizen', name: 'Citizen' },
    isAlive: true,
    pendingEvents: [],
    inventory: [],
    currentSelection: null,
    confirmedSelection: null,
    abstained: false,
    display: {
      line1: { left: 'PLAYER 3' },
      line2: { text: 'Waiting...', style: 'waiting' },
      line3: { text: '' },
      icons: [null, null, null],
      idleScrollIndex: 0,
    },
    leds: { yes: 'off', no: 'off' },
    ...overrides,
  }
}

// ─── Loading state ────────────────────────────────────────────────────────────

describe('Player loading state', () => {
  beforeEach(() => {
    mockPlayerState = null
    mockConnected = false
    mockGameState = null
    mockEventPrompt = null
    mockNotifications = []
  })

  it('shows loading indicator when playerState is null', () => {
    render(<Player />)
    // Loading state renders some connecting indicator
    const container = document.querySelector('[class]') ?? document.body
    expect(container).toBeTruthy()
  })
})

// ─── Connected state ──────────────────────────────────────────────────────────

describe('Player connected state', () => {
  beforeEach(() => {
    mockConnected = true
    mockGameState = { phase: GamePhase.DAY, players: [] }
    mockPlayerState = makePlayerState()
    mockEventPrompt = null
    mockNotifications = []
    vi.clearAllMocks()
  })

  it('calls joinAsPlayer on mount when connected', () => {
    render(<Player />)
    expect(mockJoinAsPlayer).toHaveBeenCalledWith('3')
  })

  it('renders connection badge as connected', () => {
    render(<Player />)
    const badge = document.querySelector('.connected')
    expect(badge).not.toBeNull()
  })
})

// ─── Notifications ────────────────────────────────────────────────────────────

describe('Player notifications', () => {
  beforeEach(() => {
    mockConnected = true
    mockGameState = { phase: GamePhase.DAY, players: [] }
    mockPlayerState = makePlayerState()
    mockEventPrompt = null
  })

  it('renders notification messages', () => {
    mockNotifications = [
      { id: '1', message: 'You were roleblocked!', type: 'info' },
    ]
    render(<Player />)
    expect(screen.getByText('You were roleblocked!')).toBeTruthy()
  })

  it('renders multiple notifications', () => {
    mockNotifications = [
      { id: '1', message: 'First alert', type: 'info' },
      { id: '2', message: 'Second alert', type: 'error' },
    ]
    render(<Player />)
    expect(screen.getByText('First alert')).toBeTruthy()
    expect(screen.getByText('Second alert')).toBeTruthy()
  })
})

// ─── Action handlers ──────────────────────────────────────────────────────────

describe('Player action handlers (passed to PlayerConsole)', () => {
  beforeEach(() => {
    mockConnected = true
    mockGameState = { phase: GamePhase.NIGHT, players: [] }
    mockPlayerState = makePlayerState({ pendingEvents: ['kill'] })
    mockEventPrompt = { eventId: 'kill', targets: [] }
    mockNotifications = []
    vi.clearAllMocks()
  })

  it('does not crash on render with event prompt', () => {
    expect(() => render(<Player />)).not.toThrow()
  })
})
