// client/src/test/setup.js
// Global test setup for React component tests.

import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock requestAnimationFrame / cancelAnimationFrame (not in jsdom)
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 16)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)

// Canvas stub for TinyScreen (jsdom has no 2D context implementation)
const canvasCtxStub = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  putImageData: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  setTransform: vi.fn(),
  createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  canvas: { width: 256, height: 64 },
}
HTMLCanvasElement.prototype.getContext = vi.fn(() => canvasCtxStub)
