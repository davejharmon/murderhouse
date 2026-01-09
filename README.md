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
│   ├── Game.js             # Game state machine
│   ├── Player.js           # Player model
│   └── index.js            # WebSocket server
└── client/
    └── src/
        ├── pages/          # Player, Host, Screen, Landing
        └── components/     # Reusable UI components
```

Game rules are declarative - roles and events defined in `/server/definitions/`. Events resolve by priority order (protect, investigate, shoot, vote, kill, suspect). See code for extension examples.

## Debug Mode

Set `DEBUG_MODE = true` in `shared/constants.js`:
- Access `/debug` for 9-player grid view
- Auto-select buttons on host dashboard

## Known Technical Debt & Refactoring Opportunities

### Complex Logic Consolidation

**Hunter Revenge Logic** (Priority: High)
- Currently scattered across 4 files: `Game.js` (death handling + slide queueing), `events.js` (event definition), `handlers/index.js` (selection)
- Flow: `onDeath` passive → interrupt flag → event start → special slide logic → resolution
- **Refactor Goal**: Create `HunterRevengeManager` class or consolidate into single `handleHunterRevenge()` method

**Governor Pardon State Machine** (Priority: High)
- Complex flow: Vote → Check eligibility → Set interrupt → Remove active event → Store pending resolution → Start pardon → onSelection resolves or queues execution
- Multiple state transitions make execution flow hard to trace
- **Refactor Goal**: Explicit state machine with states: `VOTE_RESOLVED` → `CHECK_PARDON` → `PARDON_EVENT` → `PARDON_DECISION` → `EXECUTION`

### Pattern Inconsistencies

**Event Outcome Naming** (Priority: Medium)
- Some events return `victim`, others `eliminated`, some neither
- Example: `vigil` uses `victim`, `vote` uses `eliminated`, `hunt` has neither
- **Refactor Goal**: Standardize on single naming convention (recommend: `victim` for kills, `target` for non-lethal)

**Silent Event Results** (Priority: Medium)
- Some events use `silent: true` for "nothing happened" cases, others return full messages
- Inconsistent handling across ~7 different event types
- **Refactor Goal**: Document pattern or enforce consistent "no-op" handling

**Pack State Broadcasting** (Priority: Medium)
- Werewolf pack state broadcast logic duplicated 3 times in `handlers/index.js` and `Game.js`
- Same conditional check: `(eventId === 'hunt' || eventId === 'kill') && player.role.team === Team.WEREWOLF`
- **Refactor Goal**: Extract helper `shouldBroadcastPackState(eventId, player)`

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
