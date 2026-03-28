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
- **Operator**: http://localhost:5173/operator (dead players send "messages from beyond" to living players)
- **Slide Editor**: http://localhost:5173/slides (dev: preview slides with mock data)
- **String Sheets**: http://localhost:5173/strings (dev: browse and override string catalog)

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
4. Majority vote eliminates player (ties go to runoff, 2 failed runoffs deadlock with no elimination)

### Night Phase

1. Each role acts secretly on their device:
   - **Nobody**: Suspect someone (tracking only)
   - **Alpha**: Choose final kill target from Cell suggestions
   - **Sleeper**: Suggest targets to the Alpha
   - **Seeker**: Investigate if someone is CELL or NOT CELL
   - **Medic**: Protect someone from death
   - **Vigilante**: One-time night kill
   - **Hunter**: No night action, but gets revenge kill when dying
   - **Judge**: No night action; can pardon condemned players after a day vote
   - **Cupid**: Link two lovers at game start (if one dies, both die)
   - **Handler**: Block one player's night ability
   - **Fixer**: Hide the victim's role when the Cell kills
   - **Chemist**: Replace the Cell's kill with a delayed poison
   - **Amateur**: Believes they are a Seeker; night action is randomly chosen
   - **Jailer**: Jail a player (protect + roleblock)
2. Host resolves events in priority order
3. Deaths revealed on big screen

### Win Conditions

- **Circle wins**: All Cell members eliminated
- **Cell wins**: Equal or outnumber Circle

## Roles

| Role            | Team    | Night Action | Special                                                                                        |
| --------------- | ------- | ------------ | ---------------------------------------------------------------------------------------------- |
| **Nobody**      | Circle  | Suspect      | —                                                                                              |
| **Seeker**      | Circle  | Investigate  | Learns if target is CELL or NOT CELL                                                           |
| **Medic**       | Circle  | Protect      | Prevents one kill per night                                                                    |
| **Hunter**      | Circle  | —            | Revenge kill on death (interrupt flow)                                                         |
| **Vigilante**   | Circle  | Kill (once)  | One-shot night kill                                                                            |
| **Judge**       | Circle  | —            | Can pardon a condemned player once per game (via Gavel)                                        |
| **Cupid**       | Circle  | Link (setup) | Links two lovers at game start; heartbreak kills both                                          |
| **Marked**      | Circle  | Suspect      | Thinks they're a Nobody; appears CELL when investigated                                        |
| **Amateur**     | Circle  | Stumble      | Disguised as Seeker; random action — investigate (accurate), kill/protect/block (shows INNOCENT)|
| **Jailer**      | Circle  | Jail         | Jails a player: target is protected and roleblocked                                            |
| **Alpha**       | Cell    | Kill         | Final kill decision; promotes successor on death                                               |
| **Sleeper**     | Cell    | Suggest      | Suggests targets to Alpha; sees pack selections live                                           |
| **Handler**     | Cell    | Block        | Blocks one player's night ability                                                              |
| **Fixer**       | Cell    | Clean        | Hides victim's role reveal when the Cell kills                                                 |
| **Chemist**     | Cell    | Poison       | Replaces Cell kill with delayed poison (victim dies next night resolve)                        |
| **Jester**      | Neutral | —            | Wins solo if voted out                                                                         |

Role composition is defined per player count in `GAME_COMPOSITION` (see `server/definitions/roles.js`). The host can pre-assign roles; roles with `companions` (e.g. Cupid) automatically inject their companion into the pool, replacing a villager. Pre-assigned compositions are validated on game start to prevent invalid setups.

## Items

| Item          | Uses      | Effect                                                               |
| ------------- | --------- | -------------------------------------------------------------------- |
| **Pistol**    | 1         | Shoot a player during the day (player-initiated, instant resolution) |
| **Gavel**     | 1         | Grants pardon ability (consumed only on actual pardon)               |
| **Clue**      | 1         | Investigate a player (same as Seeker)                                |
| **Warden**    | permanent | Jail a player each night: target is protected and roleblocked        |
| **Syringe**   | 1         | Inject a player with poison (target dies next night resolve)         |
| **Hardened**  | 1         | Absorbs one kill; destroyed on use (silent — nobody knows)           |
| **No Vote**   | 1         | Holder is excluded from the next vote (hidden)                       |
| **Coward**    | permanent | Cannot act or be targeted; immune to all (hidden)                    |
| **Marked**    | permanent | Appears CELL when investigated (hidden)                              |
| **Prospect**  | 1         | Joins the Cell if killed by them (hidden)                            |
| **Poisoned**  | —         | Slow-acting toxin; dies when next night events resolve (hidden)      |

Items are given by the host or earned via custom votes. Active items (`startsEvent`: pistol, clue, warden, syringe) appear in the player's ability selector. Hidden items are not shown on the player's terminal. Players with multiple night actions enter them sequentially by priority.

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
- **OTA firmware updates**: Host dashboard shows a banner when terminals are running outdated firmware. Press "Update" to push new firmware to all connected terminals over WiFi — they download, flash, and reboot automatically.

See `esp32-terminal/README.md` for hardware setup.

#### OTA Firmware Deployment

To deploy a new firmware version over the air:

1. Bump `FIRMWARE_VERSION` in `esp32-terminal/src/config.h`
2. Build: `pio run` (in `esp32-terminal/`)
3. Copy binary: `cp .pio/build/esp32/firmware.bin ../server/firmware/firmware.bin`
4. Update `server/firmware/version.json` to match the new version
5. Restart the server
6. Open the host dashboard — a yellow banner appears showing outdated terminals
7. Click "Update" — terminals download, flash, reboot, and reconnect

**First-time setup**: Terminals must be USB-flashed once with the OTA-capable partition table (`default_8MB.csv`). After that, all future updates can go over WiFi.

### Items & Custom Votes

- Host can give items or initiate custom votes at any time
- Custom votes can award items, change roles, or resurrect dead players
- Custom votes use the same runoff logic as standard day votes

### Governor Pardon

- After a vote eliminates a player, governor (or phone holder) can pardon
- Pardon is an interrupt flow that pauses normal resolution
- Judge role can pardon once per game; Gavel item is consumed only on actual pardon

### Cell Pack

- Cell members see each other's selections in real-time during suggest/kill events
- Packsense (line 3 during night events): left = cleanup status, center = suggest/kill target, right = poison status
- Alpha makes the final kill decision; Sleepers suggest via the suggest event

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
- Blocks instant-win setups (e.g. all Cell), duplicate alphas, and missing teams

## Architecture

```
murderhouse/
├── shared/
│   ├── constants.js              # Enums, message types, glyphs, config
│   ├── icons.js                  # 18×18 abstract icon bitmaps (role/item glyphs)
│   └── strings/
│       └── gameStrings.js        # String catalog (shared source for server and client)
├── server/
│   ├── index.js                  # WebSocket server (port 8080) + UDP discovery (8089)
│   ├── web.js                    # Production mode: Express serves client + WebSocket
│   ├── Game.js                   # Core state machine (~2750 lines)
│   ├── Player.js                 # Player model + display state (~990 lines)
│   ├── strings.js                # str(cat, key, tokens) — catalog + data/string-overrides.json
│   ├── handlers/
│   │   └── index.js              # WebSocket message routing (~695 lines)
│   ├── definitions/              # Declarative game rules
│   │   ├── roles.js              # 16 roles with events, passives, win conditions
│   │   ├── events.js             # 16 events with resolution logic
│   │   └── items.js              # 12 items
│   ├── firmware.js               # HTTP handler for OTA version check + binary download
│   ├── firmware/                 # OTA deployment: version.json + firmware.bin
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
│       ├── strings/
│       │   └── index.js          # getStr(cat, key, tokens) — catalog + localStorage overrides
│       ├── pages/
│       │   ├── Landing.jsx       # Join/create game
│       │   ├── Player.jsx        # Player console page
│       │   ├── Host.jsx          # Host dashboard
│       │   ├── Screen.jsx        # Big screen projector display (~145 lines)
│       │   ├── DebugGrid.jsx     # 9-player debug grid (/debug)
│       │   ├── Operator.jsx      # Dead-player terminal: send "messages from beyond" (/operator)
│       │   ├── SlideEditor.jsx   # Dev: preview all slide types with mock data (/slides)
│       │   └── StringSheets.jsx  # Dev: browse, filter, and override string catalog (/strings)
│       ├── components/
│       │   ├── PlayerConsole.jsx  # Full player terminal (screen + buttons)
│       │   ├── TinyScreen.jsx    # Canvas-based OLED simulator (256×64)
│       │   ├── oledFonts.js      # Bitmap font data matching ESP32 U8G2
│       │   ├── PixelGlyph.jsx    # Glyph renderer for TinyScreen
│       │   ├── ScreenPreview.jsx # Scaled iframe wrapper for the /screen route
│       │   ├── StatusLed.jsx     # Neopixel status LED indicator
│       │   ├── PlayerGrid.jsx    # Player overview grid (host/screen)
│       │   ├── EventPanel.jsx    # Event controls for host
│       │   ├── SlideControls.jsx # Slide navigation for host
│       │   ├── GameLog.jsx       # Game event log display
│       │   ├── CustomEventModal.jsx     # Custom event configuration
│       │   ├── ItemManagerModal.jsx     # Item give/revoke UI
│       │   ├── SettingsModal.jsx        # Game settings, presets, timers
│       │   ├── PortraitSelectorModal.jsx # Player portrait picker
│       │   ├── HeartbeatModal.jsx       # Heartbeat sensor configuration
│       │   ├── TutorialSlidesModal.jsx  # Role tutorial slide preview
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

Events resolve by priority (lower = earlier): link (1) → jail (3) → block (5) → protect (10) → investigate (30) → stumble (30) → shoot (40) → customEvent (45) → vote (50) → suggest (55) → inject (55) → vigil (55) → clean (58) → poison (59) → kill (60) → suspect (80).

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

### Fixed

- ~~**String catalog coverage is incomplete on the server side**~~ — `server/strings.js` provides `str(cat, key, tokens)` reading from the shared `shared/strings/gameStrings.js` catalog with file-based overrides (`data/string-overrides.json`). All `addLog()` calls in `Game.js`, `events.js`, `flows/`, `roles.js`, and `handlers/index.js` now use `str()`.
- ~~**Most client pages still hardcode strings**~~ — `Host.jsx`, `Player.jsx`, `PlayerConsole.jsx`, and all slide components now read strings via `getStr()`. The string catalog has been moved to `shared/strings/gameStrings.js` so both client and server reference the same source.
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
- ~~**Win condition polling**~~ — `checkWinCondition()` now caches its result via a `Symbol` sentinel; cache invalidates on kill, revive, role change, and coward item give/remove. `removeItem()` promoted to a game-level method so removal always flows through a single invalidating path.
- ~~**Log broadcasting**~~ — Server `addLog()` broadcasts `LOG_APPEND` with a single entry array (instead of full log on every state change); client appends to local log state. Full `LOG` snapshot still sent on initial connect. Server trims log to 500 entries; client trims to 200.
- ~~**Terminal display flicker during target selection**~~ — ESP32 terminals now run a dedicated "fast path" loop during target selection that mirrors the SELECT TERMINAL boot screen: `inputPoll → render → delay → return`. The terminal takes full ownership of display state (`terminalOwnsDisplay` flag) and ignores all server messages until the player confirms or abstains. Fast path exits automatically when server sends `targetCount == 0` (event resolved, game reset, kick) or on WebSocket disconnect. Server-side: `_executeBroadcast` skips terminal connections for players in target selection (`skipTerminalIfSelecting`); `player.send()` skips `GAME_STATE` and `EVENT_PROMPT` for all terminal connections (they never use these). Device MAC suffix shown on select screen (`1.0.1:XX`).
- ~~**OTA firmware updates**~~ — `board_build.flash_mode = dio` in `platformio.ini` fixes ESP32-S3 flash read-back failures during OTA verification ([espressif/esp-idf#8509](https://github.com/espressif/esp-idf/issues/8509)). Server sends `x-MD5` header and `Connection: close`. Terminal disconnects WebSocket before OTA and staggers download with random delay. Stale connections pruned on reconnect. Host dashboard shows firmware banner with per-terminal version tracking.
- ~~**Runoff vote terminal display stale**~~ — `_activateRunoff` now syncs terminal state without `skipTerminalIfSelecting` so terminals exit fast path and receive new runoff targets.
- ~~**Dead WebSocket connections linger after OTA reboot**~~ — Server-side WebSocket ping/pong heartbeat (15s interval) detects dead connections. `addConnection()` explicitly closes prior terminal sockets on reconnect.
- ~~**Terminal stuck on JOINING after server restart**~~ — Reconnect always sends JOIN instead of fragile REJOIN→JOIN fallback. Removed double-error bug in handleMessage that broke the fallback.

### Terminal fast path: known edge cases

- **Target list changes mid-selection** — If a player dies during a vote (e.g. shot by pistol), the terminal's cached `targetNames`/`targetIds` become stale. The player can still confirm; `confirmWithTarget` sends the explicit targetId which the server validates. Invalid targets are rejected server-side.
- **Pack hint updates blocked for wolf terminals** — During HUNT/KILL events, `broadcastPackState` sends to all cell members without `skipTerminalIfSelecting`. The `onDisplayUpdate` guard rejects these. Wolves on ESP32 terminals won't see real-time pack hint updates while scrolling, but will see the correct hint on the next full state update after confirming. Web clients are unaffected.

### Open

- **`Game.js` is a 3,300-line God Object** — Serves as state machine, event resolver, slide manager, persistence layer, and flow coordinator. Extract `EventResolver` (resolveEvent, skipEvent, resetEvent, flow handling), `SlideManager` (pushSlide variants, queue, auto-advance), and `PersistenceManager` (presets, scores, host settings) as separate classes.
- **`handlers/index.js` has 70+ handlers in one flat object** — No grouping by domain (player actions, host commands, debug). Extract into `PlayerActionsHandler`, `HostCommandsHandler`, `DebugHandler`. Add per-message payload validation middleware instead of duplicated `if (!player)` checks in every handler.
- **`Player.js` display logic is 400+ lines of tightly coupled methods** — 20+ `_display*` methods build display objects with repeated patterns. Extract a `DisplayStateBuilder` class with strategy/template pattern. Move `EVENT_ACTIONS` to `constants.js`.
- **`Host.jsx` manages 6 modals and 8+ state variables** — Extract `AutoAdvanceManager` hook (timer, pause/resume, slide queue tracking), `ModalManager` or modal context, and `MobileTabNavigator` component (swipe detection, tab switching).
- **`GameContext.jsx` has 30+ useState variables and a giant message switch** — Replace with `useReducer` grouped by domain. Extract `WebSocketManager` class for connection, reconnect, send logic. Extract message handlers into organized modules.
- **`network.cpp` hardcodes 142 operator words** — Baked in at compile time with no way to update. Move to `shared/operatorWords.js` and send from server on connection, or load from SPIFFS. Also needs JSON parse error handling — currently assumes server sends valid JSON.
- **`main.cpp` has nested state machines with scattered globals** — 10+ static state variables for connection, selection, heartbeat, encoder. Extract `TargetSelectionState`, `ResetGestureDetector`, and `TimerManager` as focused modules.
- **No linter or formatter configured** — No ESLint, no Prettier. 2-space indent convention is manual. Add config files and pre-commit hook.
- **No unit tests for core game logic** — `Game.js` event resolution, `Player.js` display state generation, and role definitions have no automated tests. Priority: event resolution priority ordering, death cascade correctness, display state priorities.
- **Magic numbers scattered across codebase** — Many extracted (`BROADCAST_DEBOUNCE_MS`, `LOG_MAX_ENTRIES`, `ABILITY_COLOR`, `WS_KEEPALIVE_MS`). Remaining: `ROLE_DISPLAY`/`ITEM_DISPLAY` color codes in `constants.js`, slide style colors, and various timeouts in `Host.jsx`.
- **Hardcoded color values in `constants.js`** — `ROLE_DISPLAY` and `ITEM_DISPLAY` objects have inline hex colors. Extract to a shared `theme.js` palette. (`Game.js` ability colors now use `ABILITY_COLOR` constants.)
- **`shared/strings/gameStrings.js` has no validation** — 319 entries in a flat array with no check that `tokens` match `{placeholder}` usage in `default`, no unused string detection, and inconsistent key nesting depth. Add a `StringCatalogValidator` and audit tool.
- **No structured logging** — Server uses `console.log` with manual prefix markers (`[Server]`, `[WS]`). No log levels. Add a lightweight logger with info/warn/error levels.

## Improvements

- Add detonator
- Add library of night and day fallback phrases
- Add a go button
- Make dead/spectator screen more simple and iconic
- Bool night actions (poison, cleanup) always trigger on debug auto-select — should abstain 50% of the time
- Hunter should die after using revenge, not before (at least visually on their own terminal if easier)

## Bugs

(none)
