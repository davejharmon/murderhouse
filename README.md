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

**Player Events Lookup** (Priority: Medium)
- `PlayerGrid.jsx` calls `getPlayerEvents()` for every player card with nested loops over eventParticipants
- Runs on every render
- **Refactor Goal**: Pre-compute reverse participant map or use `useMemo`

**Vote Tally Sorting** (Priority: Low)
- `Screen.jsx` converts and sorts tally on every render
- Small dataset, but easy win with `useMemo`

### Missing Validations

**Custom Vote Description Length** (Priority: Medium)
- `Game.js` validates description exists but no max length check
- Could cause UI overflow issues

**Runoff Round Limits** (Priority: Low)
- Hard-coded limit of 3 runoff rounds with no validation or configurability
- Consider making configurable constant

---

*This section tracks identified technical debt for future improvement. The codebase is well-structured overall; these are polish items, not critical issues.*
