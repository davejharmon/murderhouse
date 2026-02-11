# Server Test Framework Design

Vitest-based test framework for the server game logic. No client/React tests, no E2E WebSocket tests, no ESP32 tests.

## 1. Setup

### Install

```bash
npm install -D vitest
```

Vitest runs natively on ES modules (`"type": "module"` already set in `package.json`), so no transforms or special config needed.

### Scripts (root `package.json`)

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

### Config (root `vitest.config.js`)

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['server/**/*.test.js'],
  },
})
```

Minimal config — just point at server test files. No aliases, no coverage thresholds, no special setup.

---

## 2. Test Helper — `server/test/helpers.js`

A factory that creates a fully wired `Game` instance with stubbed I/O, mock players, and deterministic role assignment.

```js
import { vi } from 'vitest'
import { Game } from '../Game.js'
import { getRole } from '../definitions/roles.js'

/**
 * Create a mock WebSocket object
 * @returns {{ send: vi.fn, readyState: number, source: string }}
 */
export function mockWs(source = 'web') {
  return { send: vi.fn(), readyState: 1, source }
}

/**
 * Create a test Game instance with N players and stubbed broadcast fns.
 *
 * @param {number} playerCount - Number of players to add (4-10)
 * @param {Object} [options]
 * @param {string[]} [options.roles] - Role IDs to assign (must match playerCount)
 * @param {Object} [options.names] - Map of player ID to custom name
 * @returns {{ game: Game, players: Player[], spies: Object }}
 */
export function createTestGame(playerCount, options = {}) {
  // Stub fs before importing Game (it reads player-presets.json in constructor)
  vi.mock('fs', () => ({
    default: {
      existsSync: vi.fn(() => false),
      readFileSync: vi.fn(() => '{}'),
      writeFileSync: vi.fn(),
    },
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => '{}'),
    writeFileSync: vi.fn(),
  }))

  const broadcast = vi.fn()
  const sendToHost = vi.fn()
  const sendToScreen = vi.fn()
  const game = new Game(broadcast, sendToHost, sendToScreen)

  // Add players
  const players = []
  for (let i = 1; i <= playerCount; i++) {
    const ws = mockWs()
    const result = game.addPlayer(String(i), ws)
    players.push(result.player)
  }

  // Apply custom names
  if (options.names) {
    for (const [id, name] of Object.entries(options.names)) {
      const player = game.getPlayer(id)
      if (player) player.name = name
    }
  }

  return {
    game,
    players,
    spies: { broadcast, sendToHost, sendToScreen },
  }
}

/**
 * Start a game with a fixed role assignment (no shuffle).
 * Roles are assigned to players in seat order.
 *
 * @param {Game} game - A game in LOBBY phase with players already added
 * @param {string[]} roleIds - Role IDs in seat order, e.g. ['alpha', 'seer', 'villager', 'villager']
 */
export function startGameWithRoles(game, roleIds) {
  // Override assignRoles to use our fixed assignment
  const playerList = game.getPlayersBySeat()
  if (roleIds.length !== playerList.length) {
    throw new Error(`roleIds length (${roleIds.length}) !== player count (${playerList.length})`)
  }

  game.assignRoles = () => {
    for (let i = 0; i < playerList.length; i++) {
      const role = getRole(roleIds[i])
      if (!role) throw new Error(`Unknown role: ${roleIds[i]}`)
      playerList[i].assignRole(role)
    }
  }

  game.startGame()
}
```

### Usage Example

```js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTestGame, startGameWithRoles } from './test/helpers.js'

describe('vote elimination', () => {
  let game, players

  beforeEach(() => {
    ({ game, players } = createTestGame(4))
    startGameWithRoles(game, ['alpha', 'seer', 'villager', 'villager'])
  })

  it('majority vote eliminates the target', () => {
    game.startEvent('vote')
    // Players 2, 3, 4 vote for player 1
    game.recordSelection('2', '1')
    game.recordSelection('3', '1')
    game.recordSelection('4', '1')
    const result = game.resolveEvent('vote')
    expect(result.resolution.outcome).toBe('eliminated')
    expect(game.getPlayer('1').isAlive).toBe(false)
  })
})
```

---

## 3. Test Suites

### Suite 1: `server/definitions/events.test.js` — Pure function unit tests

Tests the exported helper functions from `events.js`. These are pure functions with no side effects.

```
tallyVotes()
  - empty results → { isEmpty: true, maxVotes: 0, frontrunners: [] }
  - unanimous (all vote same) → frontrunners has 1 entry, maxVotes = voterCount
  - split (2-way tie) → frontrunners has 2 entries, maxVotes equal
  - all abstain (all null) → isEmpty: true (null values skipped)
  - mixed votes + abstains → abstains excluded from tally, frontrunner correct

checkRunoff()
  - 1 frontrunner → returns null (clear winner)
  - 2 frontrunners, runoffRound=0 → returns { runoff: true, frontrunners }
  - 2 frontrunners, runoffRound=2 → returns { runoff: true } (still under limit)
  - 2 frontrunners, runoffRound=3 → returns { tieBreaker: true, winnerId }
  - 3+ frontrunners, runoffRound=3 → tieBreaker picks from frontrunners

getRunoffTargets()
  - no active event → returns null
  - active event without runoffCandidates → returns null
  - active event with runoffCandidates → returns the array

getTeamDisplayName()
  - village role → 'VILLAGER'
  - werewolf role → 'WEREWOLF'
  - neutral role → 'INDEPENDENT'
  - null/missing → 'PLAYER'
```

**Note:** `tallyVotes`, `checkRunoff`, `getRunoffTargets`, and `getTeamDisplayName` are currently module-private functions (not exported). To test them directly, either:
- Export them from `events.js` (preferred — they're pure utility functions)
- Test them indirectly through event `resolve()` calls

Recommended: add a named export block at the bottom of `events.js`:

```js
// Test-only exports (pure utility functions)
export { tallyVotes, checkRunoff, getRunoffTargets, getTeamDisplayName }
```

---

### Suite 2: `server/definitions/roles.test.js` — Role definition validation

Validates the structural integrity of every role definition.

```
structural validation (iterate all roles)
  - every role has required fields: id, name, team, description, color, emoji, events
  - every role's team is a valid Team enum value
  - every role's events keys match a known event ID (from events.js)
  - no duplicate role IDs

role-specific behavior
  alpha.passives.onDeath
    - with living werewolf → promotes it to alpha, returns { message }
    - no living werewolves → returns null (no promotion)

  hunter.passives.onDeath
    - returns { interrupt: true }

  doctor role
    - has protect event with priority 10

  seer role
    - has investigate event with priority 30
    - investigate.onResolve returns { isEvil: true } for werewolf target
    - investigate.onResolve returns { isEvil: false } for village target

roleDistribution
  - exists for player counts 4 through 10
  - each distribution length matches its key
  - every entry references a valid role ID
  - every distribution includes exactly 1 alpha
  - distributions with 7+ players include a regular werewolf
```

---

### Suite 3: `server/Player.test.js` — Player model unit tests

Unit tests for the `Player` class. No game instance needed for most tests.

```
constructor
  - numeric ID sets matching seatNumber (e.g., '8' → seatNumber 8)
  - default name is 'Player {seatNumber}'
  - default status is ALIVE
  - role is null, inventory is empty, pendingEvents is empty

kill() / revive()
  - kill() sets status to DEAD, records cause
  - isAlive returns false after kill
  - revive() sets status back to ALIVE
  - revive() clears deathCause

reset()
  - clears role, status, inventory, selections, pendingEvents
  - status back to ALIVE

selection lifecycle
  - selectDown cycles through valid targets, wraps at end
  - selectUp cycles through valid targets, wraps at start
  - confirmSelection() locks currentSelection into confirmedSelection
  - confirmSelection() with no currentSelection → confirmedSelection stays null
  - abstain() sets abstained=true, clears both selections
  - clearSelection() resets currentSelection, confirmedSelection, abstained

item management
  - addItem() adds to inventory with correct uses/maxUses
  - addItem() same item twice → stacks uses (no duplicate entry)
  - hasItem() returns true/false correctly
  - getItem() returns item object or null
  - canUseItem() true when uses > 0, false when 0
  - canUseItem() with maxUses=-1 → always true
  - useItem() decrements uses, returns true when depleted
  - removeItem() removes from inventory, returns true; missing returns false

connection management
  - addConnection() adds ws, connected getter returns true
  - removeConnection() removes ws
  - connected returns false when no connections or all readyState !== 1

display state (requires mock game context)
  - lobby phase → line2 'WAITING', both LEDs off
  - dead + no active event → line2 'SPECTATOR', skull glyph on line1.right
  - game over → line2 'FINISHED'
  - active event, no selection → line2 shows prompt text, waiting style
  - active event, with selection → line2 shows target name, YES LED bright
  - confirmed selection → line2 shows target name, lock glyph, both LEDs off
  - abstained → line2 'ABSTAINED', X glyph, both LEDs off
  - idle with role → line1.right shows role glyph for werewolves
```

---

### Suite 4: `server/Game.test.js` — Core state machine integration tests

Integration tests using `createTestGame()` and `startGameWithRoles()`.

```
lifecycle
  - constructor: phase=LOBBY, dayCount=0, no players
  - addPlayer: adds player, broadcasts player list
  - addPlayer when full (MAX_PLAYERS reached) → returns error
  - addPlayer when game in progress → returns error
  - removePlayer: removes player, broadcasts
  - reset(): clears players, phase back to LOBBY, dayCount=0

phase transitions
  - startGame() in LOBBY with 4+ players → phase=DAY, dayCount=1
  - startGame() with < 4 players → error
  - startGame() when not LOBBY → error
  - nextPhase() DAY → NIGHT (same dayCount)
  - nextPhase() NIGHT → DAY (dayCount increments)
  - endGame() → phase=GAME_OVER

role assignment
  - assignRoles() assigns roles from roleDistribution
  - every player gets a role after startGame()
  - startGameWithRoles() assigns exact roles in seat order

event lifecycle
  - buildPendingEvents() populates pendingEvents for current phase
  - startEvent() creates active event, sends prompts to participants
  - recordSelection() stores selection in event results
  - resolveEvent() calls event.resolve(), clears active event

vote resolution
  - majority vote → outcome='eliminated', victim killed
  - tie → triggers runoff (event stays active, runoffCandidates set)
  - 3 consecutive ties → random tiebreak, victim killed
  - all abstain → outcome='no-kill', no one dies
  - governor present + elimination → triggers GovernorPardonFlow

death queue
  - simple kill: player dies, _processDeathEffects fires
  - re-kill guard: killPlayer on dead player → returns false, no side effects
  - linked deaths: kill cupid-linked player → partner dies of heartbreak
  - cascade: kill linked hunter → onDeath fires, revenge enqueues, heartbreak enqueues, all drain
  - alpha promotion: kill alpha with living werewolf → werewolf promoted to alpha

win conditions
  - all wolves dead → returns Team.VILLAGE
  - wolves >= villagers → returns Team.WEREWOLF
  - mixed alive → returns null
  - endGame sets phase to GAME_OVER and pushes victory slide
```

#### Example: Death queue cascade test

```js
it('drains death queue sequentially for linked hunter', () => {
  const { game } = createTestGame(5)
  startGameWithRoles(game, ['alpha', 'werewolf', 'hunter', 'villager', 'villager'])

  const hunter = game.getPlayer('3')   // hunter
  const villager = game.getPlayer('4') // villager

  // Link hunter and villager (cupid lovers)
  hunter.linkedTo = '4'
  villager.linkedTo = '3'

  // Kill the hunter — should trigger:
  // 1. Hunter onDeath passive (interrupt=true → HunterRevengeFlow)
  // 2. Linked death: villager dies of heartbreak
  game.killPlayer('3', 'werewolf')

  expect(hunter.isAlive).toBe(false)
  expect(villager.isAlive).toBe(false)
  // HunterRevengeFlow should be active
  expect(game.flows.get('hunterRevenge').phase).toBe('active')
})
```

---

### Suite 5: `server/flows/flows.test.js` — Interrupt flow integration tests

Tests for `HunterRevengeFlow` and `GovernorPardonFlow`, using `createTestGame()`.

```
HunterRevengeFlow
  canTrigger
    - hunter death with { interrupt: true } → true
    - non-hunter death → false
    - hunter death without interrupt → false

  trigger
    - sets phase to 'active'
    - creates hunterRevenge event in game.activeEvents
    - sends event prompt to hunter
    - state.hunterId matches dying hunter

  getValidTargets
    - returns all alive players except the hunter
    - returns empty for non-hunter player ID

  onSelection + resolve
    - valid target → kills target, pushes death slide, cleans up
    - null target (abstain) → returns error (hunter must choose)
    - invalid target → returns error

  cleanup
    - phase back to 'idle', state cleared
    - hunterRevenge removed from activeEvents
    - hunter's pendingEvents cleared

GovernorPardonFlow
  canTrigger
    - vote elimination with living governor → true
    - vote elimination with phone holder → true
    - vote elimination, no governor or phone → false
    - vote with outcome !== 'eliminated' → false
    - vote with no victim → false

  trigger
    - sets phase to 'active'
    - creates pardon event in game.activeEvents
    - sends prompt to governor(s)
    - pushes 'CONDEMNED' slide
    - state has condemnedId, governorIds

  getValidTargets
    - returns [condemned] for eligible governor
    - returns [] for non-governor
    - returns [] if governor IS the condemned player

  pardon path (onSelection with targetId === condemnedId)
    - condemned player stays alive (was not killed yet)
    - pushes 'PARDONED' slide
    - logs pardon message
    - cleanup runs: flow back to idle

  execute path (onSelection with targetId === null / abstain)
    - condemned player killed
    - pushes 'NO PARDON' slide, then death slide
    - logs execution message
    - phone consumed if governor used phone
    - cleanup runs

  phone consumption
    - governor role pardons → phone NOT consumed (governor doesn't use phone)
    - phone holder pardons → phone consumed
    - phone holder with 0 uses left → canTrigger returns false
```

#### Example: Governor pardon path

```js
it('pardons the condemned player', () => {
  const { game } = createTestGame(5)
  startGameWithRoles(game, ['alpha', 'seer', 'governor', 'villager', 'villager'])

  // Start vote, everyone votes for player 1
  game.startEvent('vote')
  game.recordSelection('2', '1')
  game.recordSelection('3', '1')
  game.recordSelection('4', '1')
  game.recordSelection('5', '1')

  // Resolve triggers pardon flow (governor is alive)
  const result = game.resolveEvent('vote')
  expect(result.awaitingPardon).toBe(true)

  const pardonFlow = game.flows.get('pardon')
  expect(pardonFlow.phase).toBe('active')

  // Governor (player 3) pardons the condemned
  game.recordSelection('3', '1')

  // Player 1 should still be alive
  expect(game.getPlayer('1').isAlive).toBe(true)
  expect(pardonFlow.phase).toBe('idle')
})
```

---

## 4. File Map

After implementing, the test file tree looks like:

```
server/
  test/
    helpers.js              # createTestGame, mockWs, startGameWithRoles
  definitions/
    events.test.js          # Suite 1: tallyVotes, checkRunoff, etc.
    roles.test.js           # Suite 2: role validation, passives
  Player.test.js            # Suite 3: Player model
  Game.test.js              # Suite 4: state machine + integration
  flows/
    flows.test.js           # Suite 5: HunterRevenge + GovernorPardon
```

---

## 5. What's NOT Included

- **No client/React tests** — out of scope
- **No E2E WebSocket tests** — no real server bootstrap or connections
- **No ESP32 tests** — hardware platform, untestable in Node
- **No snapshot tests** — brittle for this codebase
- **No coverage thresholds** — premature; add after baseline is established
- **No mocking WebSocket library** — mock objects are sufficient (`{ send: vi.fn(), readyState: 1 }`)

## 6. Implementation Notes

### Exporting private helpers for testing

`events.js` has four private helper functions (`tallyVotes`, `checkRunoff`, `getRunoffTargets`, `getTeamDisplayName`) that should be exported for direct unit testing. These are pure functions with no side effects — exporting them is safe and preferred over testing indirectly through complex event resolution paths.

### fs mocking

`Game.js` imports `fs` at the top level for player preset persistence. The test helper mocks `fs` globally so the constructor doesn't hit the filesystem. The mock returns `false` for `existsSync` and `'{}'` for `readFileSync`.

### Deterministic randomness

Several functions use `Math.random()` (role shuffling, tiebreak selection). Tests that need deterministic outcomes should either:
- Use `startGameWithRoles()` to bypass shuffle (role assignment)
- Set up scenarios where randomness doesn't matter (clear majority, no tie)
- Mock `Math.random` with `vi.spyOn(Math, 'random').mockReturnValue(0)` for tiebreak tests
