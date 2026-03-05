// client/src/strings/index.js
// Runtime string resolution: localStorage overrides → catalog defaults.
// Usage: getStr('landing', 'title')  →  override ?? catalog default ?? key
import { STRING_CATALOG } from './gameStrings.js'

const LS_KEY = 'game_strings_overrides'

const defaults = Object.fromEntries(
  STRING_CATALOG.map(e => [`${e.cat}.${e.key}`, e.default])
)

export function getStr(cat, key) {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const overrides = raw ? JSON.parse(raw) : {}
    return overrides[`${cat}.${key}`] ?? defaults[`${cat}.${key}`] ?? key
  } catch {
    return defaults[`${cat}.${key}`] ?? key
  }
}
