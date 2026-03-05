// server/strings.js
// Runtime string resolution for server-side messages.
// Reads defaults from the shared catalog; file-based overrides from data/string-overrides.json.
// Usage: str('log', 'playerJoined', { name: 'Alice', via: 'web' })

import { STRING_CATALOG } from '../shared/strings/gameStrings.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OVERRIDES_PATH = path.join(__dirname, '../data/string-overrides.json')

// Build defaults map from catalog: 'cat.key' → default string
const defaults = Object.fromEntries(
  STRING_CATALOG.map(e => [`${e.cat}.${e.key}`, e.default])
)

// Lazily loaded file-based overrides (null = not yet loaded)
let _overrides = null

function loadOverrides() {
  if (_overrides !== null) return _overrides
  try {
    const raw = fs.readFileSync(OVERRIDES_PATH, 'utf8')
    _overrides = JSON.parse(raw)
  } catch {
    _overrides = {}
  }
  return _overrides
}

/** Invalidate the in-memory override cache (call after writing string-overrides.json). */
export function invalidateStringCache() {
  _overrides = null
}

/**
 * Resolve a catalog string with optional token substitution.
 * @param {string} cat   - Category (e.g. 'log', 'events', 'screen')
 * @param {string} key   - Key within the category (e.g. 'playerJoined')
 * @param {object} tokens - Token values to substitute (e.g. { name: 'Alice' })
 * @returns {string}
 */
export function str(cat, key, tokens = {}) {
  const k = `${cat}.${key}`
  const overrides = loadOverrides()
  let text = overrides[k] ?? defaults[k] ?? key
  for (const [token, value] of Object.entries(tokens)) {
    text = text.replaceAll(`{${token}}`, String(value))
  }
  return text
}
