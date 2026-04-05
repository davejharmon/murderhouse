// server/validateStrings.js
// Validates the STRING_CATALOG in shared/strings/gameStrings.js.
// Run with: node server/validateStrings.js
// Or via:   npm run validate:strings

import { STRING_CATALOG } from '../shared/strings/gameStrings.js'

const errors = []
const warnings = []

// Extract all {placeholder} tokens from a string
function extractTokens(str) {
  const matches = str.match(/\{[^}]+\}/g)
  return matches ? [...new Set(matches)] : []
}

const seen = new Map()

for (const entry of STRING_CATALOG) {
  const { cat, key, default: defaultValue, tokens = [] } = entry
  const fullKey = `${cat}:${key}`

  // 1. Duplicate key check
  if (seen.has(fullKey)) {
    errors.push(`Duplicate key: "${fullKey}" (first at index ${seen.get(fullKey)})`)
  } else {
    seen.set(fullKey, STRING_CATALOG.indexOf(entry))
  }

  // 2. Missing required fields
  if (!cat) errors.push(`Entry missing "cat": ${JSON.stringify(entry)}`)
  if (!key) errors.push(`Entry missing "key": ${JSON.stringify(entry)}`)
  if (defaultValue === undefined) errors.push(`Entry missing "default": "${fullKey}"`)

  if (defaultValue === undefined) continue

  // 3. Tokens declared but not used in default
  for (const token of tokens) {
    if (!defaultValue.includes(token)) {
      warnings.push(`"${fullKey}": token "${token}" listed in tokens[] but not found in default`)
    }
  }

  // 4. Placeholders used in default but not declared in tokens
  const used = extractTokens(defaultValue)
  for (const placeholder of used) {
    if (!tokens.includes(placeholder)) {
      errors.push(
        `"${fullKey}": placeholder "${placeholder}" used in default but missing from tokens[]`
      )
    }
  }
}

// Report
if (errors.length === 0 && warnings.length === 0) {
  console.log(`✓ String catalog valid — ${STRING_CATALOG.length} entries, no issues found.`)
  process.exit(0)
} else {
  if (warnings.length > 0) {
    console.warn(`\nWarnings (${warnings.length}):`)
    warnings.forEach((w) => console.warn(`  ⚠  ${w}`))
  }
  if (errors.length > 0) {
    console.error(`\nErrors (${errors.length}):`)
    errors.forEach((e) => console.error(`  ✗  ${e}`))
    process.exit(1)
  } else {
    process.exit(0)
  }
}
