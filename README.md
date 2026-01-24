# Murderhouse

A real-time multiplayer Werewolf/Mafia game designed for "eyes open" gameplay. All night actions happen on private mobile devices - no one closes their eyes.

## Quick Start

```bash
npm install
cd client && npm install
cd ../server && npm install
cd ..
npm run dev
```

Open in your browser:

- **Landing**: http://localhost:5173/
- **Host Dashboard**: http://localhost:5173/host
- **Big Screen**: http://localhost:5173/screen (projector/TV)
- **Players**: http://localhost:5173/player/1 through /player/9

## How to Play

### Setup

1. Display big screen on projector/TV
2. Each player opens their player console on mobile
3. Host opens dashboard to control game flow
4. Start game when 4-9 players ready

### Day Phase

1. Players discuss and debate who to eliminate
2. Host initiates vote when ready
3. Players select target on their devices
4. Majority vote eliminates player (ties go to runoff)

### Night Phase

1. Each role acts secretly on their device:
   - **Villager**: Suspect someone (tracking only)
   - **Werewolf**: Vote with other wolves to kill
   - **Seer**: Investigate if someone is evil
   - **Doctor**: Protect someone from death
   - **Hunter**: When killed, revenge kill someone
   - **Cupid**: Link two players (if one dies, both die)
2. Host resolves events in order
3. Deaths revealed on big screen

### Win Conditions

- **Village wins**: All werewolves eliminated
- **Werewolves win**: Equal or outnumber villagers

## Features

### Player Interface

- **UP/DOWN buttons**: Navigate targets/abilities
- **YES button**: Confirm selection (immutable)
- **NO button**: Abstain from action (immutable)

### Physical Terminals

ESP32-based physical terminals can be used alongside or instead of mobile devices:

- **Dial** to select player ID (1-9) on boot
- **Rotary switch** navigates targets (same as swipe)
- **Arcade buttons** for YES/NO actions with LED feedback
- **OLED display** shows same game state as mobile
- **Multi-connection**: Web client and physical terminal can control the same player simultaneously

See `esp32-terminal/README.md` for hardware setup.

### Items & Custom Votes

- Host can give items (pistol) or initiate custom votes
- Custom votes can award items, change roles, or resurrect players
- Items add special abilities (e.g., pistol lets you shoot during day)

### Governor Pardon

- Governor can pardon the eliminated player
- Pardon happens after vote results revealed
- Can only pardon once per game

## Architecture

```
murderhouse/
├── shared/
│   └── constants.js        # Message types, phases, enums
├── server/
│   ├── definitions/        # Declarative game rules
│   │   ├── roles.js        # Role definitions
│   │   ├── events.js       # Event definitions
│   │   └── items.js        # Item definitions
│   ├── flows/              # Complex multi-step flows
│   │   ├── InterruptFlow.js       # Base class for interrupt flows
│   │   ├── HunterRevengeFlow.js   # Hunter death revenge logic
│   │   └── GovernorPardonFlow.js  # Vote pardon logic
│   ├── Game.js             # Game state machine
│   ├── Player.js           # Player model
│   └── index.js            # WebSocket server
└── client/
    └── src/
        ├── pages/          # Player, Host, Screen, Landing
        └── components/     # Reusable UI components
```

Game rules are declarative - roles and events defined in `/server/definitions/`. Events resolve by priority order (protect, investigate, shoot, vote, kill, suspect). Complex interrupt-based features (Hunter revenge, Governor pardon) are consolidated in `/server/flows/` with explicit state machines.

## Debug Mode

Set `DEBUG_MODE = true` in `shared/constants.js`:

- Access `/debug` for 9-player grid view
- Auto-select buttons on host dashboard

## Known Technical Debt & Refactoring Opportunities

### Complex Logic Consolidation (COMPLETED)

Complex interrupt-based flows are now consolidated into self-contained Flow classes in `server/flows/`:

**Hunter Revenge** - `server/flows/HunterRevengeFlow.js`

- State machine: `idle` -> `active` (hunter dies) -> `resolving` (target selected) -> `idle`
- All logic in one file with explicit state documentation

**Governor Pardon** - `server/flows/GovernorPardonFlow.js`

- State machine: `idle` -> `active` (vote condemns) -> `pardoned` OR `executed` -> `idle`
- Handles both governor role and phone item holders

See `server/flows/InterruptFlow.js` for the base class pattern.

### Pattern Inconsistencies

**Event Outcome Naming** (COMPLETED)

- Standardized all lethal event outcomes to use `victim` property
- Outcome types preserved for semantics: `eliminated` (day vote), `killed` (night kills)
- Updated: `events.js`, `Game.js`, `GovernorPardonFlow.js`

**Silent Event Results** (COMPLETED)

- Documented pattern in `events.js` schema comment
- `silent: true` = internal no-ops (no logging, no slides)
- Omit silent = log message to host
- Include `slide` = show on big screen
- Fixed `kill` event no-kill case to use `silent: true` for consistency

**Pack State Broadcasting** (COMPLETED)

- Extracted `game.shouldBroadcastPackState(eventId, player)` helper method
- Updated all 3 call sites in `Game.js` and `handlers/index.js`

**Slide Management** (COMPLETED)

- Slides are purely presentation - they don't trigger game logic
- All public events create slides consistently
- Centralized `queueDeathSlide()` handles death slides + hunter revenge follow-up
- Removed deferred execution pattern (`pendingEventId`, `pendingResolutions`)
- Vote resolution now executes immediately, then queues tally + death slides
- Heartbreak deaths now get their own death slides
- Host advances through slides manually or via auto-advance

### Performance Optimizations

**Player Events Lookup** (COMPLETED)

- `PlayerGrid.jsx` now uses `useMemo` for `playerEvents` and `allTargeters` maps
- Extracted `PlayerCard` as memoized component with custom comparison
- Fixed server broadcasting duplicate state to host (public + host state)

**Vote Tally Sorting** (Priority: Low)

- `Screen.jsx` converts and sorts tally on every render
- Small dataset, but easy win with `useMemo`

### Definition Schema Cleanup

**Item Schema Disconnect** (COMPLETED)

- Replaced empty `events: {}` and `passives: {}` with declarative activation model:
  - `startsEvent: string` - Item starts this event when activated (idle-activatable)
  - `grantsAbility: string` - Item grants this ability for flows to check (situational)
- Handler now reads `getItem(itemId).startsEvent` instead of hardcoded map
- Example: `pistol.startsEvent: 'shoot'`, `phone.grantsAbility: 'pardon'`

**Role/Event Handler Duplication** (Priority: Low)

- Roles like `seer` define `events.investigate.onResolve` which duplicates logic also in `events.js investigate.resolve`
- Both layers compute the same investigation result
- **Clarify**: Should roles only declare participation (`vote: {}`) while events own all resolution logic? Or should role handlers override event handlers?

### Flow Migration Candidates

**Shoot Event** (Priority: Low)

- Uses `onSelection` pattern for immediate action (kill target, consume item)
- Similar to flow pattern but not formalized as a Flow class
- Works fine as-is, but inconsistent with hunter revenge which IS a flow
- **Consider**: Formalize as `PistolShootFlow` if shoot gains complexity (e.g., protection, misfires)

### Missing Validations

**Custom Vote Description Length** (Priority: Medium)

- `Game.js` validates description exists but no max length check
- Could cause UI overflow issues

**Runoff Round Limits** (Priority: Low)

- Hard-coded limit of 3 runoff rounds with no validation or configurability
- Consider making configurable constant

### ESP32 Terminal Issues

**JSON Field Validation** (Priority: Medium)

- `network.cpp parsePlayerState()` assumes all JSON fields exist and are correct types
- If server sends malformed data (e.g., `line1: null`), terminal could crash
- **Fix**: Add null checks before accessing nested JSON objects, use ArduinoJson's `containsKey()` and type checking

**Display Text Overflow** (Priority: Low)

- Text centering calculation `(DISPLAY_WIDTH - textWidth) / 2` can produce negative X coordinates
- Extremely long player names or descriptions could render off-screen
- **Fix**: Clamp X coordinate to 0 minimum, or truncate long strings with ellipsis

**WiFi Reconnection Strategy** (Priority: Medium)

- No exponential backoff when WiFi reconnection fails repeatedly
- Terminal could spam connection attempts, wasting power and bandwidth
- **Fix**: Implement backoff strategy (e.g., 1s, 2s, 4s, 8s delays) with max retry limit before requiring manual reset

### Server Race Conditions

**Concurrent recordSelection() Calls** (Priority: Low - mitigated by Node.js single-threaded model)

- Multiple WebSocket messages for same player/event could interleave in event loop
- `instance.results[pid]` could be overwritten if messages arrive in quick succession
- **Fix**: Add check `if (instance.results[pid] !== undefined) return` at start of selection recording
- **Note**: Node.js single-threaded nature makes this unlikely in practice

**Flow Trigger During Event Resolution** (Priority: Medium)

- A flow's `onSelection()` could trigger game state changes while `resolveEvent()` is in progress
- Hunter revenge flow could fire while vote resolution is running
- **Fix**: Add `isResolving` flag to prevent flow triggers during resolution, queue them instead

**Broadcast During Partial State** (Priority: Low)

- Multiple `broadcastGameState()` calls during event processing could send inconsistent snapshots
- **Fix**: Batch state updates and broadcast once at end of operation

### Server Connection Management

**Stale Connections in Player.connections Array** (Priority: Low)

- Closed WebSocket connections may remain in array until explicitly removed
- `connected` getter now checks `readyState`, but array could grow with dead references
- **Fix**: Periodically prune connections with `readyState !== 1`, or prune on each `send()` call

**Event/Flow ID Namespace Collision** (Priority: Medium)

- Regular events and flow events share the same `activeEvents` map
- If an event and flow have the same ID, they could collide
- **Fix**: Use prefixed IDs for flows (e.g., `flow:hunterRevenge`) or separate maps

### Server Validation Gaps

**Player ID Validation** (Priority: Low)

- JOIN handler accepts any `playerId` without validation
- Empty strings, special characters, or extremely long IDs are not rejected
- **Fix**: Add regex validation for player ID format, reject invalid formats with error

**Circular Linked Deaths** (Priority: Low)

- `checkLinkedDeaths()` doesn't prevent infinite loops if `player.linkedTo` creates a cycle
- Cupid role with corrupted state could cause stack overflow
- **Fix**: Track visited players in a Set, skip already-processed players

**Event Participant Validation** (Priority: Low)

- Dead players could still be in runoff `participants` if they die between rounds
- **Fix**: Filter `participants` through `getAlivePlayers()` before starting runoff

---

_This section tracks identified technical debt for future improvement. The codebase is well-structured overall; these are polish items, not critical issues._
