# Murderhouse

A real-time multiplayer Werewolf/Mafia game designed for "eyes open" gameplay - no one needs to close their eyes during night phases, as all actions are performed on private mobile devices.

## Quick Start

```bash
# Install dependencies
npm install
cd client && npm install
cd ../server && npm install
cd ..

# Run development mode (server + client)
npm run dev
```

Open in your browser:

- **Landing Page**: http://localhost:5173/
- **Host Dashboard**: http://localhost:5173/host
- **Big Screen** (projector): http://localhost:5173/screen
- **Player Consoles**: http://localhost:5173/player/1 through /player/9

## Architecture

```
murderhouse/
├── shared/                    # Shared constants between client/server
│   └── constants.js           # Message types, phases, enums
├── server/
│   ├── definitions/           # Declarative game rules
│   │   ├── roles.js           # Role definitions (villager, werewolf, seer, etc.)
│   │   └── events.js          # Event definitions (vote, kill, investigate, etc.)
│   ├── handlers/              # WebSocket message handlers
│   ├── Game.js                # Core game state machine
│   ├── Player.js              # Player model
│   └── index.js               # Server entry point
└── client/
    └── src/
        ├── context/           # React context (WebSocket state)
        ├── components/        # Reusable UI components
        ├── pages/             # Route pages (Player, Host, Screen, Landing)
        └── styles/            # Global CSS
```

## Design Principles

### Declarative Game Rules

Roles and events are defined declaratively in `/server/definitions/`. To add a new role:

```javascript
// server/definitions/roles.js
export const roles = {
  myNewRole: {
    id: 'myNewRole',
    name: 'My New Role',
    team: Team.VILLAGE,
    description: 'Description shown to player',
    color: '#hex',
    events: {
      vote: {}, // Participates in voting
      myCustomEvent: {
        priority: 30, // Lower = resolves earlier
        canTarget: (player, target, game) => true,
        onResolve: (player, target, game) => ({ success: true }),
      },
    },
    passives: {
      onDeath: (player, killer, game) => {
        /* triggered when killed */
      },
    },
  },
};
```

### Event Resolution Order

Events resolve in priority order (lower number = earlier):

1. **protect** (10) - Doctor's protection
2. **investigate** (30) - Seer's investigation
3. **vote** (50) - Day elimination vote
4. **kill** (60) - Werewolf attack
5. **suspect** (80) - Villager suspicion tracking

### Player Interface

Players use a swipe-based interface on their phones:

- **Swipe Up/Down** (or tap buttons) to navigate through targets
- **Confirm** to lock in selection
- **Cancel** to change selection before event resolves

The "tiny screen" shows contextual information based on game state.

## Game Flow

### Lobby

1. Players join via `/player/1` through `/player/9`
2. Host connects at `/host`
3. Big screen displays at `/screen`
4. Host clicks "Start Game" when 4-9 players are ready

### Day Phase

1. Players discuss (verbally, in-person)
2. Host starts "vote" event
3. Players select targets on their devices
4. Host resolves vote - majority is eliminated
5. Role is revealed on big screen

### Night Phase

1. Host advances to night
2. Host starts all events (protect, investigate, kill, suspect)
3. Each role acts on their private device
4. Host resolves events in priority order
5. Results shown (deaths, but not who did what)

### Win Conditions

- **Village wins**: All werewolves eliminated
- **Werewolves win**: Werewolves equal or outnumber villagers

## Roles

| Role     | Team     | Night Action                                    |
| -------- | -------- | ----------------------------------------------- |
| Villager | Village  | Suspect (track who you think is evil)           |
| Werewolf | Werewolf | Kill (vote with other wolves)                   |
| Seer     | Village  | Investigate (learn if target is evil)           |
| Doctor   | Village  | Protect (save someone from death)               |
| Hunter   | Village  | Revenge (kill someone when you die)             |
| Cupid    | Village  | Link (bind two players - if one dies, both die) |

### Role Distribution

| Players | Composition                                           |
| ------- | ----------------------------------------------------- |
| 4       | 1 werewolf, 1 seer, 2 villagers                       |
| 5       | 1 werewolf, 1 seer, 3 villagers                       |
| 6       | 1 werewolf, 1 seer, 1 doctor, 3 villagers             |
| 7       | 2 werewolves, 1 seer, 1 doctor, 3 villagers           |
| 8       | 2 werewolves, 1 seer, 1 doctor, 4 villagers           |
| 9       | 2 werewolves, 1 seer, 1 doctor, 1 hunter, 4 villagers |

## Extending the Game

### Adding a New Event

```javascript
// server/definitions/events.js
export const events = {
  myEvent: {
    id: 'myEvent',
    name: 'My Event',
    description: 'Shown to participants',
    phase: [GamePhase.NIGHT],
    priority: 40,

    participants: (game) =>
      game.getAlivePlayers().filter((p) => p.role.id === 'myRole'),
    validTargets: (actor, game) =>
      game.getAlivePlayers().filter((p) => p.id !== actor.id),

    aggregation: 'individual', // or 'majority'
    allowAbstain: true,

    resolve: (results, game) => {
      // results = { playerId: targetId, ... }
      // Return { success: true, slide: {...}, message: '...' }
    },
  },
};
```

### Adding a New Passive

Passives are triggered by game events:

```javascript
passives: {
  onDeath: (player, killer, game) => {
    // Triggered when this player dies
    // Return { interrupt: true } to pause for player action
  },
  onNightStart: (player, game) => {
    // Triggered at start of each night
  },
  onDayStart: (player, game) => {
    // Triggered at start of each day
  },
}
```

## Technical Notes

### WebSocket Protocol

Messages follow the format: `{ type: string, payload: object }`

**Client → Server:**

- `join` - Join as player
- `selectUp` / `selectDown` - Navigate targets
- `confirm` / `cancel` - Lock/unlock selection
- `hostConnect` / `screenConnect` - Connect as host/screen
- `startGame`, `nextPhase`, `startEvent`, `resolveEvent`, etc.

**Server → Client:**

- `gameState` - Full game state update
- `playerState` - Private player state
- `slide` - Current slide for big screen
- `eventPrompt` - Event details for participant
- `eventResult` - Private result (e.g., seer investigation)

### State Management

React context (`GameContext`) manages all WebSocket communication and state. Components subscribe to the context and receive updates automatically.

### Styling

CSS Modules with a Severance-inspired aesthetic:

- Dark backgrounds (#0a0c0f, #141820)
- IBM Plex Mono for headings/UI
- IBM Plex Sans for body text
- Accent colors for roles and status indicators

## License

MIT
