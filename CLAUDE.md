# Murderhouse

Real-time multiplayer Werewolf/Mafia game with "eyes-open" gameplay. Players use private mobile web clients or ESP32 physical terminals instead of closing their eyes. Supports 4-10 players with web UI, ESP32 hardware terminals, projector display, and host dashboard.

## Quick Start

```bash
npm run dev          # Starts server + client concurrently
```

- Host dashboard: http://localhost:5173/host
- Player N: http://localhost:5173/player/N (1-9)
- Big screen: http://localhost:5173/screen
- Debug grid: http://localhost:5173/debug (requires DEBUG_MODE=true in shared/constants.js)

Server runs on ws://localhost:8080, client on http://localhost:5173.

## Project Structure

```
shared/constants.js          # Enums, message types, config (GamePhase, Team, ServerMsg, ClientMsg)
server/
  index.js                   # WebSocket server entry point (port 8080 + UDP 8089)
  Game.js                    # Core game state machine (~1950 lines)
  Player.js                  # Player model (role, status, inventory, connections)
  definitions/
    roles.js                 # Declarative role definitions (villager, werewolf, seer, etc.)
    events.js                # Declarative event definitions (vote, kill, protect, etc.)
    items.js                 # Item definitions (pistol, phone, clue)
  flows/                     # Interrupt flows for complex multi-step mechanics
    InterruptFlow.js         # Base class
    HunterRevengeFlow.js     # Hunter death → revenge pick
    GovernorPardonFlow.js    # Vote condemn → pardon option
  handlers/index.js          # WebSocket message routing
client/
  vite.config.js             # Path aliases: @ → src/, @shared → shared/
  src/
    context/GameContext.jsx   # Central WebSocket state management
    pages/                   # Landing, Player, Host, Screen, DebugGrid
    components/              # PlayerConsole, TinyScreen, StatusLed, PlayerGrid, etc.
    styles/global.css        # Severance-inspired aesthetic
esp32-terminal/
  platformio.ini             # ESP32-S3, PlatformIO config
  src/                       # main.cpp, display, input, leds, network, config.h
  pcb/                       # EasyEDA PCB design files
```

## Architecture

### Communication

All clients (web + ESP32) connect via WebSocket to the Node.js server on port 8080. ESP32 terminals auto-discover the server via UDP broadcast on port 8089. One player ID can have multiple simultaneous connections (web + ESP32).

### Game Logic — Three Layers

1. **Declarative Definitions** (`server/definitions/`) — Roles, events, and items are data-driven. Roles declare their team, event participation, passives, and win conditions. Events declare participants, targets, resolution logic, and slides.
2. **State Machine** (`server/Game.js`) — Manages phase transitions (LOBBY → DAY/NIGHT → GAME_OVER), event resolution by priority, death propagation, win condition checks, and slide queues.
3. **Interrupt Flows** (`server/flows/`) — Complex multi-step mechanics (hunter revenge, governor pardon) that pause normal resolution. Flows declare `static get hooks()` for trigger dispatch via `Game._checkFlows()`, and return structured results (`{ kills, slides, consumeItems, log }`) processed by `Game._executeFlowResult()`.

### Display Format

All interfaces share a 3-line display format:

- Line 1: Context (player number, role, phase, event)
- Line 2: Main content (target name, result)
- Line 3: Instructions (button labels)

Glyphs like `:wolf:`, `:pistol:` render as emoji in React, ASCII on ESP32.

### WebSocket Messages

```
Client → Server:  { type: "confirm" | "selectDown" | "useItem" | ..., payload: {} }
Server → Client:  { type: "playerState" | "eventPrompt" | "slide" | ..., payload: {} }
```

Message types defined in `shared/constants.js` (ServerMsg, ClientMsg).

### Event Resolution

Events resolve by priority order. Each returns `{ success, outcome, victim?, slide?, silent? }`. Results queue as slides for the big screen. Host advances slides manually or via auto-advance.

## Tech Stack

- **Server**: Node.js, `ws` (WebSocket), ES modules
- **Client**: React 19, Vite 6, React Router 7, CSS Modules
- **ESP32**: PlatformIO, Arduino framework, ESP32-S3, SSD1322 OLED (U8g2), WS2811 neopixel
- **No linter or test framework configured**

## Conventions

- ES6 `import`/`export` everywhere (both server and client)
- `camelCase` variables/functions, `PascalCase` classes/components, `CONSTANT_CASE` enums
- Leading underscore for private methods: `_startFlowEvent()`
- Boolean prefix: `isAlive`, `hasActiveEvent`
- React: functional components, hooks, CSS Modules, Context API
- 2-space indentation, no semicolons enforcement
- Console logs prefixed: `[Server]`, `[WS]`, `[Screen]`

## ESP32 Development

```bash
# In esp32-terminal/
pio run                    # Build
pio run --target upload    # Flash
pio device monitor         # Serial (115200 baud)
```

Configure WiFi in `esp32-terminal/src/config.h` before flashing.
