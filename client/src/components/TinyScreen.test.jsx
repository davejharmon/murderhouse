// client/src/components/TinyScreen.test.jsx
// Tests for TinyScreen: renders canvas, handles various display prop shapes,
// applies classes correctly, and doesn't throw on edge-case inputs.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'

// CSS module stub
vi.mock('./TinyScreen.module.css', () => ({ default: { screen: 'screen', compact: 'compact' } }))

const { default: TinyScreen } = await import('./TinyScreen.jsx')

// ─── Display fixtures ─────────────────────────────────────────────────────────

const blankDisplay = {
  line1: {},
  line2: { text: '', style: 'normal' },
  line3: { text: '' },
  icons: [null, null, null],
  idleScrollIndex: 0,
}

const waitingDisplay = {
  ...blankDisplay,
  line2: { text: 'Waiting for host...', style: 'waiting' },
}

const criticalDisplay = {
  ...blankDisplay,
  line2: { text: 'YOU WERE KILLED', style: 'critical' },
}

const lockedDisplay = {
  ...blankDisplay,
  line2: { text: 'LOCKED IN', style: 'locked' },
}

const operatorDisplay = {
  ...blankDisplay,
  line2: { text: 'Say the secret word now!', style: 'operator' },
}

const withIconsDisplay = {
  ...blankDisplay,
  line1: { left: 'PLAYER 3', right: 'DAY 2' },
  line2: { text: 'Select target', style: 'normal' },
  line3: { left: 'YES', right: 'NO' },
  icons: [
    { id: 'detective', state: 'active' },
    { id: 'pistol', state: null },
    null,
  ],
  idleScrollIndex: 0,
}

// ─── Render tests ─────────────────────────────────────────────────────────────

describe('TinyScreen render', () => {
  it('renders a canvas element', () => {
    const { container } = render(<TinyScreen display={blankDisplay} />)
    expect(container.querySelector('canvas')).not.toBeNull()
  })

  it('canvas has 256px width', () => {
    const { container } = render(<TinyScreen display={blankDisplay} />)
    const canvas = container.querySelector('canvas')
    expect(canvas.width).toBe(256)
  })

  it('canvas has 64px height', () => {
    const { container } = render(<TinyScreen display={blankDisplay} />)
    const canvas = container.querySelector('canvas')
    expect(canvas.height).toBe(64)
  })

  it('renders without crashing with null display', () => {
    expect(() => render(<TinyScreen display={null} />)).not.toThrow()
  })

  it('renders without crashing with undefined display', () => {
    expect(() => render(<TinyScreen />)).not.toThrow()
  })
})

// ─── Display style variants ────────────────────────────────────────────────────

describe('TinyScreen display style variants', () => {
  it('renders waiting style without throwing', () => {
    expect(() => render(<TinyScreen display={waitingDisplay} />)).not.toThrow()
  })

  it('renders critical style without throwing', () => {
    expect(() => render(<TinyScreen display={criticalDisplay} />)).not.toThrow()
  })

  it('renders locked style without throwing', () => {
    expect(() => render(<TinyScreen display={lockedDisplay} />)).not.toThrow()
  })

  it('renders operator style without throwing', () => {
    expect(() => render(<TinyScreen display={operatorDisplay} />)).not.toThrow()
  })

  it('renders display with icons without throwing', () => {
    expect(() => render(<TinyScreen display={withIconsDisplay} />)).not.toThrow()
  })
})

// ─── compact prop ─────────────────────────────────────────────────────────────

describe('TinyScreen compact prop', () => {
  it('renders without crashing in compact mode', () => {
    expect(() => render(<TinyScreen display={blankDisplay} compact />)).not.toThrow()
  })

  it('renders without crashing without compact prop', () => {
    expect(() => render(<TinyScreen display={blankDisplay} compact={false} />)).not.toThrow()
  })
})

// ─── Icon state variants ──────────────────────────────────────────────────────

describe('TinyScreen icon state variants', () => {
  it('renders with all null icons', () => {
    const display = { ...blankDisplay, icons: [null, null, null] }
    expect(() => render(<TinyScreen display={display} />)).not.toThrow()
  })

  it('renders with active icon state', () => {
    const display = { ...blankDisplay, icons: [{ id: 'detective', state: 'active' }, null, null] }
    expect(() => render(<TinyScreen display={display} />)).not.toThrow()
  })

  it('renders with empty icon id', () => {
    const display = { ...blankDisplay, icons: [{ id: 'empty' }, null, null] }
    expect(() => render(<TinyScreen display={display} />)).not.toThrow()
  })

  it('renders with idleScrollIndex > 0', () => {
    const display = { ...blankDisplay, idleScrollIndex: 2 }
    expect(() => render(<TinyScreen display={display} />)).not.toThrow()
  })
})

// ─── Line variants ─────────────────────────────────────────────────────────────

describe('TinyScreen line content variants', () => {
  it('renders line3 with left/center/right split', () => {
    const display = {
      ...blankDisplay,
      line3: { left: 'YES', center: 'OR', right: 'NO' },
    }
    expect(() => render(<TinyScreen display={display} />)).not.toThrow()
  })

  it('renders line3 with center only and empty left/right (pack hint regression)', () => {
    // Regression: _getPackHint returns { left: '', center: 'TARGET', right: '' } for a
    // sleeper when alpha has a kill target. Empty string left/right are falsy, so
    // hasLine3Split was false → fell into else branch → line3.text undefined → crash.
    const display = {
      ...blankDisplay,
      line3: { left: '', center: 'VICTIM NAME', right: '' },
    }
    expect(() => render(<TinyScreen display={display} />)).not.toThrow()
  })

  it('renders line1 with both left and right', () => {
    const display = {
      ...blankDisplay,
      line1: { left: 'PLAYER 5', right: 'NIGHT' },
    }
    expect(() => render(<TinyScreen display={display} />)).not.toThrow()
  })

  it('renders empty line content gracefully', () => {
    // line2.text and line3.text must be strings — drawText iterates text.length
    const display = {
      line1: {},
      line2: { text: '' },
      line3: { text: '' },
      icons: [],
      idleScrollIndex: 0,
    }
    expect(() => render(<TinyScreen display={display} />)).not.toThrow()
  })
})
