# Murderhouse

A real-time multiplayer Werewolf/Mafia game designed for "eyes open" gameplay. All night actions happen on private mobile devices or ESP32 physical terminals - no one closes their eyes. Supports 4-10 players.

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
- **Players**: http://localhost:5173/player/1 through /player/10

For production/remote deployment, `server/web.js` serves the built client over HTTP alongside the WebSocket server on a single port.

## How to Play

### Setup

1. Display big screen on projector/TV
2. Each player opens their player console on mobile
3. Host opens dashboard to control game flow
4. Start game when 4-10 players ready

### Day Phase

1. Players discuss and debate who to eliminate
2. Host initiates vote when ready
3. Players select target on their devices
4. Majority vote eliminates player (ties go to runoff, 3+ runoffs break randomly)

### Night Phase

1. Each role acts secretly on their device:
   - **Villager**: Suspect someone (tracking only)
   - **Alpha Werewolf**: Choose final kill target from pack suggestions
   - **Werewolf**: Suggest targets to the alpha
   - **Seer**: Investigate if someone is a werewolf
   - **Doctor**: Protect someone from death
   - **Vigilante**: One-time night kill (single use per game)
   - **Hunter**: Normal villager, but gets revenge kill when dying
   - **Governor**: Can pardon condemned players after a day vote
   - **Cupid**: Link two lovers at game start (if one dies, both die)
   - **Roleblocker**: Block one player's night ability
   - **Janitor**: Hide the victim's role when the pack kills
   - **Poisoner**: Replace the pack's kill with a delayed poison
   - **Drunk**: Believes they are a Seer; night action is randomly chosen
2. Host resolves events in priority order
3. Deaths revealed on big screen

### Win Conditions

- **Village wins**: All werewolves eliminated
- **Werewolves win**: Equal or outnumber villagers

## Roles

| Role            | Team     | Night Action | Special                                                                                        |
| --------------- | -------- | ------------ | ---------------------------------------------------------------------------------------------- |
| **Villager**    | Village  | Suspect      | —                                                                                              |
| **Seer**        | Village  | Investigate  | Learns if target is EVIL or INNOCENT                                                           |
| **Doctor**      | Village  | Protect      | Prevents one kill per night                                                                    |
| **Hunter**      | Village  | —            | Revenge kill on death (interrupt flow)                                                         |
| **Vigilante**   | Village  | Kill (once)  | One-shot night kill, then becomes villager                                                     |
| **Governor**    | Village  | —            | Can pardon a condemned player once per game                                                    |
| **Cupid**       | Village  | Link (setup) | Links two lovers at game start; heartbreak kills both                                          |
| **Tanner**      | Village  | Suspect      | Sees themselves as Villager; appears EVIL to the Seer (and Clue); wins with village            |
| **Drunk**       | Village  | Stumble      | Disguised as Seer; random action — investigate (accurate), kill/protect/block (shows INNOCENT) |
| **Alpha**       | Werewolf | Kill         | Final kill decision; promotes successor on death                                               |
| **Werewolf**    | Werewolf | Hunt         | Suggests targets to alpha; sees pack selections live                                           |
| **Roleblocker** | Werewolf | Block        | Blocks one player's night ability                                                              |
| **Janitor**     | Werewolf | Clean        | Hides victim's role reveal when the pack kills                                                 |
| **Poisoner**    | Werewolf | Poison       | Replaces pack kill with delayed poison (victim dies next night)                                |

Role composition is defined per player count in `GAME_COMPOSITION` (see `server/definitions/roles.js`). The host can pre-assign roles; roles with `companions` (e.g. Cupid) automatically inject their companion into the pool, replacing a villager. Pre-assigned compositions are validated on game start to prevent invalid setups.

## Items

| Item       | Uses | Effect                                                               |
| ---------- | ---- | -------------------------------------------------------------------- |
| **Pistol** | 1    | Shoot a player during the day (player-initiated, instant resolution) |
| **Phone**  | 1    | Grants pardon ability (same as Governor, consumed on use)            |
| **Clue**   | 1    | Investigate a player (same as Seer)                                  |

Items are given by the host. Items with `startsEvent` (pistol, crystal ball) appear in the player's ability selector when idle. Items stack if the same type is given twice.

## Features

### Player Interface

- **UP/DOWN buttons**: Navigate targets/abilities
- **YES button**: Confirm selection (immutable once locked)
- **NO button**: Abstain from action (immutable once locked)
- **Icon column**: Right-edge display showing 18×18 abstract glyphs for role and inventory; scroll with dial/buttons when idle

### Physical Terminals

ESP32-based physical terminals can be used alongside or instead of mobile devices:

- **Dial** to select player ID (1-9) on boot
- **Rotary switch** navigates targets (same as UP/DOWN)
- **Arcade buttons** for YES/NO actions with LED feedback
- **OLED display** shows same 3-line game state as mobile
- **Multi-connection**: Web client and physical terminal can control the same player simultaneously

See `esp32-terminal/README.md` for hardware setup.

### Items & Custom Votes

- Host can give items or initiate custom votes at any time
- Custom votes can award items, change roles, or resurrect dead players
- Custom votes use the same runoff logic as standard day votes

### Governor Pardon

- After a vote eliminates a player, governor (or phone holder) can pardon
- Pardon is an interrupt flow that pauses normal resolution
- Governor role can pardon once per game; phone item is consumed on use

### Werewolf Pack

- Werewolves see each other's selections in real-time during hunt/kill events
- Pack hint shows the most popular target among living packmates (pluralizes dynamically)
- Alpha makes the final kill decision; non-alpha wolves suggest via the hunt event

### Event Timers

- Host can start a countdown timer on any active event
- Pushes a radial countdown slide to the big screen (depleting ring with participant gallery)
- When time expires the event force-resolves regardless of missing responses

### Big Screen

- Confirmed-player highlighting during active events
- Victory screen shows winner gallery with portraits
- Event timer slides with radial countdown animation

### Composition Validation

- Pre-assigned role compositions are validated on game start
- Blocks instant-win setups (e.g. all werewolves), duplicate alphas, and missing teams

## Architecture

```
murderhouse/
├── shared/
│   ├── constants.js              # Enums, message types, glyphs, config
│   └── icons.js                  # 18×18 abstract icon bitmaps (role/item glyphs)
├── server/
│   ├── index.js                  # WebSocket server (port 8080) + UDP discovery (8089)
│   ├── web.js                    # Production mode: Express serves client + WebSocket
│   ├── Game.js                   # Core state machine (~1950 lines)
│   ├── Player.js                 # Player model + display state (~850 lines)
│   ├── handlers/
│   │   └── index.js              # WebSocket message routing (~660 lines)
│   ├── definitions/              # Declarative game rules
│   │   ├── roles.js              # 14 roles with events, passives, win conditions
│   │   ├── events.js             # 13 events with resolution logic
│   │   └── items.js              # 3 items (pistol, phone, clue)
│   ├── flows/                    # Interrupt flows for multi-step mechanics
│   │   ├── InterruptFlow.js      # Base class (idle → active → resolving)
│   │   ├── HunterRevengeFlow.js  # Hunter death → revenge pick → kill
│   │   └── GovernorPardonFlow.js # Vote condemn → pardon/execute decision
│   ├── player-presets.json       # Saved player name/portrait presets (legacy single slot)
│   └── game-presets.json         # Named multi-slot game presets (names, portraits, role pool, settings)
├── client/
│   ├── vite.config.js            # Path aliases: @ → src/, @shared → shared/
│   └── src/
│       ├── main.jsx              # App entry point
│       ├── App.jsx               # Router setup
│       ├── context/
│       │   └── GameContext.jsx    # Central WebSocket state management
│       ├── pages/
│       │   ├── Landing.jsx       # Join/create game
│       │   ├── Player.jsx        # Player console page
│       │   ├── Host.jsx          # Host dashboard
│       │   ├── Screen.jsx        # Big screen projector display
│       │   └── DebugGrid.jsx     # 9-player debug grid
│       ├── components/
│       │   ├── PlayerConsole.jsx  # Full player terminal (screen + buttons)
│       │   ├── TinyScreen.jsx    # Canvas-based OLED simulator (256×64)
│       │   ├── oledFonts.js      # Bitmap font data matching ESP32 U8G2
│       │   ├── PixelGlyph.jsx    # Glyph renderer for TinyScreen
│       │   ├── StatusLed.jsx     # Neopixel status LED indicator
│       │   ├── PlayerGrid.jsx    # Player overview grid (host/screen)
│       │   ├── EventPanel.jsx    # Event controls for host
│       │   ├── SlideControls.jsx # Slide navigation for host
│       │   ├── GameLog.jsx       # Game event log display
│       │   ├── CustomEventModal.jsx    # Custom event configuration
│       │   ├── SettingsModal.jsx  # Game settings, presets, timers
│       │   ├── PortraitSelectorModal.jsx # Player portrait picker
│       │   └── Modal.jsx         # Reusable modal component
│       └── styles/
│           └── global.css        # Severance-inspired aesthetic
└── esp32-terminal/
    ├── platformio.ini            # ESP32-S3, PlatformIO config
    ├── src/
    │   ├── main.cpp              # Entry point, setup/loop
    │   ├── display.cpp/.h        # SSD1322 OLED rendering (U8g2)
    │   ├── input.cpp/.h          # Rotary encoder + arcade buttons
    │   ├── leds.cpp/.h           # WS2811 neopixel button LEDs
    │   ├── network.cpp/.h        # WiFi + WebSocket + UDP discovery
    │   ├── protocol.h            # Message parsing
    │   ├── icons.h               # 18×18 icon bitmaps (ESP32 counterpart of shared/icons.js)
    │   └── config.h              # WiFi credentials, pin assignments
    └── pcb/                      # EasyEDA PCB design files
```

### Three-Layer Game Logic

1. **Declarative Definitions** (`server/definitions/`) — Roles, events, and items are data-driven. Roles declare their team, event participation, passives, and win conditions. Events declare participants, targets, aggregation type, and resolution logic.

2. **State Machine** (`server/Game.js`) — Manages phase transitions (LOBBY → DAY ↔ NIGHT → GAME_OVER), event lifecycle (pending → active → resolved), death propagation with linked death cascades, win condition checks, and the slide queue for the big screen.

3. **Interrupt Flows** (`server/flows/`) — Complex multi-step mechanics that pause normal resolution. Each flow declares `static get hooks()` (e.g., `['onDeath']`, `['onVoteResolution']`) and `Game._checkFlows(hook, context)` dispatches to the matching flow. Resolution methods return structured result objects (`{ kills, slides, consumeItems, log }`) processed uniformly by `Game._executeFlowResult()` — flows never mutate Game state directly.

### Event Resolution Pipeline

1. Phase starts → `buildPendingEvents()` filters events with eligible participants
2. Host starts event → creates instance, sends prompts to participants
3. Players act → selections recorded; some events resolve immediately (shoot)
4. Host resolves → outcome computed, slides queued, deaths processed
5. Death cascade → `killPlayer()` queues deaths sequentially; each fires onDeath passives (hunter revenge, alpha promotion) then propagates linked deaths (cupid lovers)
6. Win check → runs after every kill and phase transition
7. Phase transition → clears all event state, advances day counter

### Event Priority Order

Events resolve by priority (lower = earlier): block (5) → protect (10) → investigate (30) → stumble (30) → shoot (40) → customEvent (45) → vote (50) → hunt (55) → vigil (55) → clean (58) → poison (59) → kill (60) → suspect (80).

## Adding a Role

Checklist for adding a new role to the game:

1. **Constants** (`shared/constants.js`) — Add to `RoleId` enum, add to `AVAILABLE_ROLES`. If the role has a unique event, add to `EventId` too.
2. **Role definition** (`server/definitions/roles.js`) — Add role object with `id`, `name`, `team`, `description`, `color`, `emoji`, `tip`, `events`, and `passives`. Add to `GAME_COMPOSITION` for relevant player counts.
3. **Event definition** (`server/definitions/events.js`) — If the role has a unique event, add event with `id`, `phase`, `priority`, `participants`, `validTargets`, `aggregation`, `allowAbstain`, and `resolve`.
4. **Player model** (`server/Player.js`) — Add `EVENT_ACTIONS` entry for the new event (confirm/abstain/prompt labels). Add any new state flags (e.g. `isRoleblocked`) and reset them in `resetForPhase()` and `kill()`.
5. **Game engine** (`server/Game.js`) — Only needed if the role requires special resolution logic beyond what the event `resolve()` function handles.
6. **Icons** (`shared/icons.js` + `esp32-terminal/src/icons.h`) — Add 18x18 XBM bitmap, add to `Icons` map (JS) and `getIconBitmap()` (C++). Use identical byte data in both files.
7. **Client UI** (`client/src/components/EventPanel.jsx`) — Add to `availableRoles` array for the custom event modal.
8. **Docs** (`README.md`) — Update roles table, composition notes, and event priority order.

## Debug Mode

Enabled automatically outside production (`process.env.NODE_ENV !== 'production'`). Set `NODE_ENV=production` to disable.

- Access `/debug` for 9-player grid view
- Auto-select buttons on host dashboard

## Testing

Server-only tests using [Vitest](https://vitest.dev/). See [`server/TESTING.md`](server/TESTING.md) for the full test framework design.

```bash
npm test              # Run all server tests once
npm run test:watch    # Watch mode (re-runs on file change)
```

## Known Technical Debt & Refactoring Opportunities

### High Impact

1. **String catalog coverage is incomplete on the server side** — `client/src/strings/gameStrings.js` catalogs ~200 user-visible strings, and `client/src/strings/index.js` provides `getStr(cat, key)` for runtime lookup from localStorage overrides. However, server-side strings (all `addLog()` calls, event resolution messages, slide text built in `events.js` and flows) are still hardcoded template literals. There is no server-side analogue of `getStr()`. A `str(cat, key, tokens)` helper in `server/strings.js` that reads from a shared JSON catalog (or the same `gameStrings.js` via `@shared`) would make the catalog complete and auditable with a single grep. Without this, the `/strings` tool can display server-side strings but cannot apply edits back to running game logic.

2. **Most client pages still hardcode strings** — Only `Landing.jsx` currently reads strings via `getStr()`. `Host.jsx`, `Player.jsx`, `PlayerConsole.jsx`, and the slide components in `client/src/components/slides/` all still hardcode their display text. Wiring these to the catalog is mechanical but has not been done.

### Medium Impact




### Low Impact

1. **Win condition polling** — `checkWinConditions()` runs after every kill, phase transition, and vote resolution. It re-scans all players each time. Could cache the result and only invalidate on death/resurrection.

2. **Log broadcasting** — The server broadcasts the last 50 log entries to all clients on every state change. Append-only log streaming would reduce payload size.

### Fixed

- ~~**`Screen.jsx` is a 1200-line monolith**~~ — All 14 slide types extracted into individual components under `client/src/components/slides/`. `Screen.jsx` is now ~145 lines. A `/slides` dev tool at `/slides` lets you preview all slide types with mock data and edit strings live.
- ~~**`broadcastGameState()` called excessively**~~ — Schedules via `queueMicrotask()` with a `_broadcastScheduled` flag; multiple calls per synchronous handler now coalesce into one send.
- ~~**ABSTAINED state lost on fast event resolve**~~ — `player.syncState()` now called before `player.clearFromEvent()` in `resolveEvent` so `getActiveResult()` can read the null result and display ABSTAINED correctly.
- ~~**Dead WebSocket connections accumulate**~~ — Not an issue: `on('close')` in `server/index.js` already calls `player.removeConnection(ws)`.
- ~~**No error handling around file I/O**~~ — Read paths have try/catch with safe fallbacks; write failures are caught by the top-level handler try/catch in `handleMessage`.
- ~~**`DEBUG_MODE` hardcoded to `true`**~~ — Now reads `process.env.NODE_ENV !== 'production'`; set `NODE_ENV=production` to disable debug routes and auto-select buttons.
- ~~**Host-auth check repeated 40+ times**~~ — Replaced with `requireHost(fn)` decorator in `server/handlers/index.js`; all 40 host handlers wrapped.
- ~~**No WebSocket reconnect backoff**~~ — Exponential backoff in `GameContext.jsx`: 2 s → 4 s → 8 s → 30 s max; resets to 2 s on successful reconnect.
- ~~**`resolveEvent()` does too much**~~ — Extracted into `_checkResponsesComplete`, `_applyRoleblocks`, `_cleanupParticipants`, `_commitResolution`, `_dispatchPrivateResults`; `resolveEvent` is now a ~20-line orchestration shell.
- ~~**Interrupt flows don't handle player disconnect**~~ — Added `onPlayerDisconnect(player)` hook to `InterruptFlow` base class. Hunter auto-resolves with a random target; Governor auto-executes when all governors disconnect. Wired via `game.notifyFlowsOfDisconnect()` called from `server/index.js` on last-connection close.
- ~~**No event definition validation**~~ — `_assertValidEventDef(event, eventId)` validates `resolve`, `participants`, `validTargets`, and `aggregation` at `startEvent()` time; throws with a clear message on misconfiguration.
- ~~**Duplicate event startup code**~~ — Extracted `_notifyEventParticipants()` shared by `startEvent`, `_startFlowEvent`, and `_startCustomEvent`; removed ~40 lines of duplication.
- ~~**Magic numbers in BPM colour function**~~ — Extracted `BPM_COLOR` constants in `slideUtils.js` with explanatory names.
- ~~**Flow result shape undocumented**~~ — Added `@typedef FlowResult` JSDoc at the top of `InterruptFlow.js` documenting all fields and their semantics.
- ~~**Item consumption rules are implicit**~~ — Documented `IMMEDIATE / ON_RESOLVE / ON_TRIGGER` consumption timing in `server/definitions/items.js` schema comment with concrete examples per item type.

## Improvements

- Add suspect functionality
- Add slide to game end that shows score including suspect tracking
- Add glyph for Jester
  Add new role: Jailer
- Add detonator
- Add library of night and day fallback phrases
- Add a go button
- export all slides for string review

## Bugs

- VILLAGER/WEREWOLF should have different colours to kill/hunt actions
- replace emojis with fancy pixel art - in progress could look better
- janitor is missing a glyph
- Poisoned victim should not say 'poisoned' on death - more generic
- poison death will be skipped if you go next phase
- Scrubbing back / auto advance broken on ghost message
