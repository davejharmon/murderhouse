// client/src/context/GameContext.test.jsx
// Tests for GameProvider state management and WebSocket message handling.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { GameProvider, useGame } from './GameContext'
import { ServerMsg } from '@shared/constants.js'

// ─── Mock WebSocket ───────────────────────────────────────────────────────────

let mockWsInstance = null
let mockOnMessage = null

class MockWebSocket {
  constructor(url) {
    this.readyState = WebSocket.CONNECTING
    this.send = vi.fn()
    this.close = vi.fn()
    mockWsInstance = this
    // Simulate async open
    setTimeout(() => {
      this.readyState = WebSocket.OPEN
      this.onopen?.()
    }, 0)
  }
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
}

// Capture context values from a test consumer
function makeCapture() {
  const captured = { current: null }
  function Consumer() {
    captured.current = useGame()
    return null
  }
  return { captured, Consumer }
}

function renderProvider(Consumer) {
  return render(
    <GameProvider>
      <Consumer />
    </GameProvider>
  )
}

function simulateMessage(type, payload) {
  act(() => {
    mockWsInstance?.onmessage?.({ data: JSON.stringify({ type, payload }) })
  })
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  globalThis.WebSocket = MockWebSocket
  mockWsInstance = null
})

afterEach(() => {
  vi.clearAllMocks()
})

// ─── Initial state ────────────────────────────────────────────────────────────

describe('GameProvider initial state', () => {
  it('connected is false before WebSocket opens', () => {
    const { captured, Consumer } = makeCapture()
    renderProvider(Consumer)
    expect(captured.current.connected).toBe(false)
  })

  it('gameState is null initially', () => {
    const { captured, Consumer } = makeCapture()
    renderProvider(Consumer)
    expect(captured.current.gameState).toBeNull()
  })

  it('playerState is null initially', () => {
    const { captured, Consumer } = makeCapture()
    renderProvider(Consumer)
    expect(captured.current.playerState).toBeNull()
  })

  it('log is empty array initially', () => {
    const { captured, Consumer } = makeCapture()
    renderProvider(Consumer)
    expect(captured.current.log).toEqual([])
  })

  it('notifications is empty array initially', () => {
    const { captured, Consumer } = makeCapture()
    renderProvider(Consumer)
    expect(captured.current.notifications).toEqual([])
  })
})

// ─── Connection ───────────────────────────────────────────────────────────────

describe('GameProvider connection', () => {
  it('connected becomes true when WebSocket opens', async () => {
    const { captured, Consumer } = makeCapture()
    renderProvider(Consumer)

    await waitFor(() => expect(captured.current.connected).toBe(true))
  })
})

// ─── Message handlers ─────────────────────────────────────────────────────────

describe('GameProvider message handlers', () => {
  it('GAME_STATE sets gameState', async () => {
    const { captured, Consumer } = makeCapture()
    renderProvider(Consumer)
    await waitFor(() => expect(mockWsInstance).not.toBeNull())

    const payload = { phase: 'DAY', dayCount: 1, players: [] }
    simulateMessage(ServerMsg.GAME_STATE, payload)

    expect(captured.current.gameState).toEqual(payload)
  })

  it('PLAYER_STATE sets playerState', async () => {
    const { captured, Consumer } = makeCapture()
    renderProvider(Consumer)
    await waitFor(() => expect(mockWsInstance).not.toBeNull())

    const payload = { id: '1', name: 'Alice', pendingEvents: [] }
    simulateMessage(ServerMsg.PLAYER_STATE, payload)

    expect(captured.current.playerState).toEqual(payload)
  })

  it('LOG replaces log array', async () => {
    const { captured, Consumer } = makeCapture()
    renderProvider(Consumer)
    await waitFor(() => expect(mockWsInstance).not.toBeNull())

    simulateMessage(ServerMsg.LOG, ['entry1', 'entry2'])

    expect(captured.current.log).toEqual(['entry1', 'entry2'])
  })

  it('LOG_APPEND appends to log', async () => {
    const { captured, Consumer } = makeCapture()
    renderProvider(Consumer)
    await waitFor(() => expect(mockWsInstance).not.toBeNull())

    simulateMessage(ServerMsg.LOG, ['existing'])
    simulateMessage(ServerMsg.LOG_APPEND, ['new1', 'new2'])

    expect(captured.current.log).toContain('existing')
    expect(captured.current.log).toContain('new1')
    expect(captured.current.log).toContain('new2')
  })

  it('SLIDE_QUEUE sets slideQueue', async () => {
    const { captured, Consumer } = makeCapture()
    renderProvider(Consumer)
    await waitFor(() => expect(mockWsInstance).not.toBeNull())

    const payload = { queue: [{ id: 'slide-1', type: 'title' }], currentIndex: 0, current: null }
    simulateMessage(ServerMsg.SLIDE_QUEUE, payload)

    expect(captured.current.slideQueue.queue.length).toBe(1)
  })

  it('EVENT_PROMPT sets eventPrompt and clears eventResult', async () => {
    const { captured, Consumer } = makeCapture()
    renderProvider(Consumer)
    await waitFor(() => expect(mockWsInstance).not.toBeNull())

    const prompt = { eventId: 'kill', targets: [] }
    simulateMessage(ServerMsg.EVENT_PROMPT, prompt)

    expect(captured.current.eventPrompt).toEqual(prompt)
    expect(captured.current.eventResult).toBeNull()
  })

  it('EVENT_RESULT clears eventPrompt', async () => {
    const { captured, Consumer } = makeCapture()
    renderProvider(Consumer)
    await waitFor(() => expect(mockWsInstance).not.toBeNull())

    simulateMessage(ServerMsg.EVENT_PROMPT, { eventId: 'kill', targets: [] })
    simulateMessage(ServerMsg.EVENT_RESULT, { message: 'You killed Alice' })

    expect(captured.current.eventPrompt).toBeNull()
    expect(captured.current.eventResult).toBeDefined()
  })

  it('PLAYER_STATE clears eventPrompt when event no longer pending', async () => {
    const { captured, Consumer } = makeCapture()
    renderProvider(Consumer)
    await waitFor(() => expect(mockWsInstance).not.toBeNull())

    // Set an event prompt for 'kill'
    simulateMessage(ServerMsg.EVENT_PROMPT, { eventId: 'kill', targets: [] })
    expect(captured.current.eventPrompt).not.toBeNull()

    // Send player state with 'kill' absent from pendingEvents
    simulateMessage(ServerMsg.PLAYER_STATE, { id: '1', pendingEvents: [] })

    expect(captured.current.eventPrompt).toBeNull()
  })

  it('PLAYER_STATE preserves eventPrompt when event still pending', async () => {
    const { captured, Consumer } = makeCapture()
    renderProvider(Consumer)
    await waitFor(() => expect(mockWsInstance).not.toBeNull())

    simulateMessage(ServerMsg.EVENT_PROMPT, { eventId: 'kill', targets: [] })
    simulateMessage(ServerMsg.PLAYER_STATE, { id: '1', pendingEvents: ['kill', 'vote'] })

    expect(captured.current.eventPrompt).not.toBeNull()
  })

  it('HOST_SETTINGS sets hostSettings', async () => {
    const { captured, Consumer } = makeCapture()
    renderProvider(Consumer)
    await waitFor(() => expect(mockWsInstance).not.toBeNull())

    simulateMessage(ServerMsg.HOST_SETTINGS, { timerDuration: 45, autoAdvanceEnabled: true })

    expect(captured.current.hostSettings?.timerDuration).toBe(45)
  })

  it('SCORES sets scores object', async () => {
    const { captured, Consumer } = makeCapture()
    renderProvider(Consumer)
    await waitFor(() => expect(mockWsInstance).not.toBeNull())

    simulateMessage(ServerMsg.SCORES, { scores: { Alice: 5, Bob: 3 } })

    expect(captured.current.scores).toEqual({ Alice: 5, Bob: 3 })
  })
})

// ─── send() ───────────────────────────────────────────────────────────────────

describe('GameProvider.send()', () => {
  it('sends serialized JSON when WebSocket is open', async () => {
    const { captured, Consumer } = makeCapture()
    renderProvider(Consumer)
    await waitFor(() => expect(captured.current.connected).toBe(true))

    act(() => { captured.current.send('confirm', { playerId: '1' }) })

    expect(mockWsInstance.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'confirm', payload: { playerId: '1' } })
    )
  })

  it('does not send when WebSocket is not open', () => {
    const { captured, Consumer } = makeCapture()
    renderProvider(Consumer)
    // Not awaiting open — still CONNECTING

    act(() => { captured.current.send('confirm', {}) })

    expect(mockWsInstance?.send).not.toHaveBeenCalled()
  })
})

// ─── addNotification ──────────────────────────────────────────────────────────

describe('GameProvider.addNotification()', () => {
  it('adds notification with id and type', async () => {
    const { captured, Consumer } = makeCapture()
    renderProvider(Consumer)

    act(() => { captured.current.addNotification('Hello', 'info') })

    expect(captured.current.notifications.length).toBe(1)
    expect(captured.current.notifications[0].message).toBe('Hello')
    expect(captured.current.notifications[0].type).toBe('info')
    expect(captured.current.notifications[0].id).toBeDefined()
  })

  it('notifications auto-dismiss after 5 seconds', async () => {
    vi.useFakeTimers()
    const { captured, Consumer } = makeCapture()
    renderProvider(Consumer)

    act(() => { captured.current.addNotification('Timer test', 'info') })
    expect(captured.current.notifications.length).toBe(1)

    await act(async () => { vi.advanceTimersByTime(5100) })
    expect(captured.current.notifications.length).toBe(0)

    vi.useRealTimers()
  })
})
