# Murderhouse

A real-time multiplayer Werewolf/Mafia game designed for "eyes open" gameplay. All night actions happen on private mobile devices or ESP32 physical terminals — no one closes their eyes. Supports 4-10 players.

## Quick Start

```bash
npm install
cd client && npm install
cd ../server && npm install
cd ..
npm run dev
```

- **Landing**: http://localhost:5173/
- **Host Dashboard**: http://localhost:5173/host
- **Big Screen**: http://localhost:5173/screen
- **Players**: http://localhost:5173/player/1 through /player/10
- **Operator**: http://localhost:5173/operator (dead players send messages to living players)
- **Slide Editor**: http://localhost:5173/slides (dev: preview slides with mock data)
- **String Sheets**: http://localhost:5173/strings (dev: browse and override string catalog)

For production/remote deployment, `server/web.js` serves the built client over HTTP alongside the WebSocket server on a single port.

## How to Play

**Day Phase**: Players discuss, host initiates vote, majority eliminates a player. Ties go to runoff; two failed runoffs deadlock with no elimination.

**Night Phase**: Each role acts secretly on their device. Host resolves events in priority order. Deaths revealed on big screen.

**Win conditions**: Circle wins when all Cell members are eliminated. Cell wins when they equal or outnumber the Circle.

## Roles

| Role          | Team    | Night Action | Special                                                                                          |
| ------------- | ------- | ------------ | ------------------------------------------------------------------------------------------------ |
| **Nobody**    | Circle  | Suspect      | —                                                                                                |
| **Seeker**    | Circle  | Investigate  | Learns if target is CELL or NOT CELL                                                             |
| **Medic**     | Circle  | Protect      | Prevents one kill per night                                                                      |
| **Hunter**    | Circle  | —            | Revenge kill on death (interrupt flow)                                                           |
| **Vigilante** | Circle  | Kill (once)  | One-shot night kill                                                                              |
| **Governor**  | Circle  | —            | Can pardon a condemned player once per game (via Gavel)                                          |
| **Cupid**     | Circle  | Link (setup) | Links two lovers at game start; heartbreak kills both                                            |
| **Marked**    | Circle  | Suspect      | Thinks they're a Nobody; appears CELL when investigated                                          |
| **Amateur**   | Circle  | Stumble      | Disguised as Seeker; random action — investigate (accurate), kill/protect/block (shows INNOCENT) |
| **Jailer**    | Circle  | Jail         | Jails a player: target is protected and roleblocked                                              |
| **Alpha**     | Cell    | Kill         | Final kill decision; promotes successor on death                                                 |
| **Sleeper**   | Cell    | Suggest      | Suggests targets to Alpha; sees pack selections live                                             |
| **Handler**   | Cell    | Block        | Blocks one player's night ability                                                                |
| **Fixer**     | Cell    | Clean        | Hides victim's role reveal when the Cell kills                                                   |
| **Chemist**   | Cell    | Poison       | Replaces Cell kill with delayed poison (victim dies next night resolve)                          |
| **Jester**    | Neutral | —            | Wins solo if voted out                                                                           |

Role composition is defined per player count in `GAME_COMPOSITION` (`server/definitions/roles.js`). The host can pre-assign roles; roles with `companions` (e.g. Cupid) automatically inject their companion into the pool. Pre-assigned compositions are validated on game start.

## Items

| Item         | Uses      | Effect                                                               |
| ------------ | --------- | -------------------------------------------------------------------- |
| **Pistol**   | 1         | Shoot a player during the day (player-initiated, instant resolution) |
| **Gavel**    | 1         | Grants pardon ability (consumed only on actual pardon)               |
| **Clue**     | 1         | Investigate a player (same as Seeker)                                |
| **Warden**   | permanent | Jail a player each night: target is protected and roleblocked        |
| **Syringe**  | 1         | Inject a player with poison (target dies next night resolve)         |
| **Hardened** | 1         | Absorbs one kill; destroyed on use (silent)                          |
| **No Vote**  | 1         | Holder is excluded from the next vote (hidden)                       |
| **Coward**   | permanent | Cannot act or be targeted; immune to all (hidden)                    |
| **Marked**   | permanent | Appears CELL when investigated (hidden)                              |
| **Prospect** | 1         | Joins the Cell if killed by them (hidden)                            |
| **Poisoned** | —         | Slow-acting toxin; dies when next night events resolve (hidden)      |

## Architecture

```
murderhouse/
├── shared/
│   ├── constants.js              # Enums, message types, config
│   ├── icons.js                  # 18×18 abstract icon bitmaps
│   ├── theme.js                  # Named color constants
│   └── strings/
│       └── gameStrings.js        # String catalog (shared by server and client)
├── server/
│   ├── index.js                  # WebSocket server (port 8080) + UDP discovery (8089)
│   ├── web.js                    # Production: Express serves client + WebSocket
│   ├── Game.js                   # Core state machine (~1700 lines)
│   ├── Player.js                 # Player model + display state
│   ├── strings.js                # str(cat, key, tokens) — catalog + data/string-overrides.json
│   ├── PersistenceManager.js     # Host settings, scores, game presets, end-game scoring
│   ├── SlideManager.js           # Slide queue, death slides, tutorial slides
│   ├── EventResolver.js          # Event lifecycle, timers, vote/runoff resolution
│   ├── handlers/
│   │   ├── index.js              # WebSocket message router
│   │   ├── connection.js         # Join, reconnect, heartbeat
│   │   ├── player.js             # Player actions (select, confirm, items)
│   │   ├── host.js               # Host commands (start, resolve, give items, etc.)
│   │   └── debug.js              # Debug/dev-only handlers
│   ├── definitions/
│   │   ├── roles.js              # 16 role definitions
│   │   ├── events.js             # 16 event definitions
│   │   └── items.js              # 12 item definitions
│   ├── flows/
│   │   ├── InterruptFlow.js      # Base class (idle → active → resolving)
│   │   ├── HunterRevengeFlow.js  # Hunter death → revenge pick → kill
│   │   └── GovernorPardonFlow.js # Vote condemn → pardon/execute decision
│   └── firmware/                 # OTA deployment: version.json + firmware.bin
├── client/
│   └── src/
│       ├── context/
│       │   ├── GameContext.jsx        # Provider + useGame() hook — composes reducer + WS hook
│       │   └── gameReducer.js        # initialState + gameReducer (all server-message-driven state)
│       ├── hooks/
│       │   ├── useWebSocket.js       # WS connection lifecycle + exponential-backoff reconnect
│       │   ├── useAutoAdvance.js     # Slide auto-advance timer for Host
│       │   └── useHostModals.js      # Modal/overlay visibility state for Host
│       ├── strings/index.js           # getStr(cat, key, tokens) — catalog + localStorage overrides
│       ├── pages/                     # Landing, Player, Host, Screen, DebugGrid, Operator, SlideEditor, StringSheets
│       └── components/               # PlayerConsole, TinyScreen, PlayerGrid, EventPanel, SlideControls, modals, etc.
└── esp32-terminal/
    ├── platformio.ini            # ESP32-S3, PlatformIO config
    └── src/                      # main.cpp, display, input, leds, network, config.h, icons.h
```

### Three-Layer Game Logic

1. **Declarative Definitions** (`server/definitions/`) — Roles, events, and items are data-driven. Roles declare team, event participation, passives, and win conditions. Events declare participants, targets, aggregation type, and resolution logic.

2. **State Machine** (`server/Game.js`) — Manages phase transitions (LOBBY → DAY ↔ NIGHT → GAME_OVER), event lifecycle, death propagation, win condition checks, and the slide queue. Delegates to `PersistenceManager`, `SlideManager`, and `EventResolver` sub-objects.

3. **Interrupt Flows** (`server/flows/`) — Complex multi-step mechanics that pause normal resolution. Each flow declares `static get hooks()` and `Game._checkFlows()` dispatches to the matching flow. Resolution methods return structured `{ kills, slides, consumeItems, log }` objects processed by `Game._executeFlowResult()`.

### Event Priority Order

Events resolve by priority (lower = earlier): link (1) → jail (3) → block (5) → protect (10) → investigate (30) → stumble (30) → shoot (40) → customEvent (45) → vote (50) → suggest (55) → inject (55) → vigil (55) → clean (58) → poison (59) → kill (60) → suspect (80).

## ESP32 Terminals

ESP32-based physical terminals can be used alongside or instead of mobile devices. Dial to select player ID, rotary switch navigates targets, arcade buttons for YES/NO with LED feedback, OLED display shows the same 3-line game state as mobile.

**OTA firmware updates**: Host dashboard shows a banner when terminals are running outdated firmware. Press "Update" to push new firmware to all connected terminals over WiFi.

To deploy firmware:
1. Bump `FIRMWARE_VERSION` in `esp32-terminal/src/config.h`
2. Build: `pio run` (in `esp32-terminal/`)
3. Copy: `cp .pio/build/esp32/firmware.bin ../server/firmware/firmware.bin`
4. Update `server/firmware/version.json`
5. Restart server; click "Update" in host dashboard

See `esp32-terminal/README.md` for hardware setup.

## Adding a Role

1. **Constants** (`shared/constants.js`) — Add to `RoleId` enum and `AVAILABLE_ROLES`. Add to `EventId` if new event needed.
2. **Role definition** (`server/definitions/roles.js`) — Add role object with `id`, `name`, `team`, `description`, `color`, `emoji`, `tip`, `events`, `passives`. Add to `GAME_COMPOSITION`.
3. **Event definition** (`server/definitions/events.js`) — If new event needed: `id`, `phase`, `priority`, `participants`, `validTargets`, `aggregation`, `allowAbstain`, `resolve`.
4. **Player model** (`server/Player.js`) — Add `EVENT_ACTIONS` entry for confirm/abstain/prompt labels. Add any new state flags and reset them in `resetForPhase()` and `kill()`.
5. **Icons** (`shared/icons.js` + `esp32-terminal/src/icons.h`) — Add 18×18 XBM bitmap. Use identical byte data in both files.
6. **Client UI** (`client/src/components/EventPanel.jsx`) — Add to `availableRoles` for the custom event modal.
7. **Docs** (`README.md`) — Update roles table and event priority order.

## Testing

304 tests across server (Vitest/node) and React client (Vitest/jsdom + Testing Library). Covers Game lifecycle, phase transitions, role assignment, event resolution, vote/runoff logic, death cascades, win conditions, interrupt flows, all role abilities, all item mechanics, and game interaction paths. Sub-object unit tests for `PersistenceManager`, `SlideManager`, `EventResolver`. React component tests for `GameContext`, `Player`, `Host`, and `TinyScreen`.

```bash
npm test                          # Run all 304 tests (server + client)
npm test -- --project server      # Server tests only (249)
npm test -- --project client      # Client tests only (55)
npm run test:watch                # Watch mode
```

See [`server/TESTING.md`](server/TESTING.md) for the full test framework design.

### Test Coverage Gaps

**Game mechanics** — paths not yet covered:
- Custom event: item reward / role reward / resurrection paths

## Debug Mode

Enabled outside production (`process.env.NODE_ENV !== 'production'`). Access `/debug` for 9-player grid view.

## Known Issues & Backlog

### Open

- **`network.cpp` operator words** — 142 words baked in at compile time. Move to `shared/operatorWords.js` and send from server.
- **`main.cpp`** — 10+ static state variables for connection, selection, heartbeat. Extract focused modules.
- **No structured logging** — Server uses `console.log` with manual prefix markers. No log levels.

### Refactoring Phase Plan

- **Phase 1 — Foundation** ✅ — Linter/Prettier, `shared/theme.js` color constants, string catalog validator.
- **Phase 2 — Server leaf nodes** ✅ — Split `handlers/index.js` into domain groups. Extracted `DisplayStateBuilder` from `Player.js`.
- **Phase 3 — Core** ✅ — 124 unit tests for `Game.js`. Extracted `EventResolver`, `SlideManager`, `PersistenceManager` from `Game.js` (3500 → 1700 lines).
- **Phase 3b — Comprehensive mechanics tests** ✅ — Full coverage of all role abilities, item mechanics, and game mechanics. Unified test runner covers server (Vitest/node) and React client (Vitest/jsdom + Testing Library). Sub-object unit tests for `PersistenceManager`, `SlideManager`, `EventResolver`.
- **Phase 3c — EventResolver refinement** ✅ — Extracted `VoteResolver` from `EventResolver` (tally slides, runoff, deferred/immediate resolution paths). Fixed `_startFlowEvent` boundary (flows now call `game.events._startFlowEvent`, not `game._startFlowEvent`). Split `showTallyAndDeferResolution` into `_resolveDeferred` + `_resolveImmediate`.
- **Phase 4 — Client** ✅ — `GameContext.jsx` split into `gameReducer.js` (state + reducer) + `useWebSocket.js` (WS transport hook). `Host.jsx` split into `useAutoAdvance.js` (slide auto-advance timer) + `useHostModals.js` (overlay/modal visibility state). All 304 tests passing.
- **Phase 5 — ESP32** — Move hardcoded operator words to `shared/operatorWords.js`. Refactor `main.cpp` globals into focused modules. Add C++ unit tests via PlatformIO's Unity framework (`esp32-terminal/test/`) to cover display layout, button input, and network message parsing — deferred until Phase 5; React client tests (Track B) provide equivalent behavioral coverage in the interim.

## Improvements

- Add detonator
- Add library of night and day fallback phrases
- Add a rollback to last turn
- Adjust poison turn started/item uses
- Make dead/spectator/coward/gameover screen larger text on ESP32
- Hunter should die after using revenge, not before (visually on their own terminal)

## Bugs

- Reveal Comp tutorial slide shows hidden roles (prospect, marked) — should display them as Nobodies
- Sleeper night action broken with alpha in game
- Vote timer breaks on second attempt
