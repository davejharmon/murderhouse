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

To be reconsidered - old list too out of date.

## Buglist

(none)

## Improvements

- Add a line 3 statement to team werewolf on day 1 game start identifying partner.
- Add glyphs for inventory
- Improve spacing on terminal screen to allow bigger glyphs.
- Resolve issues
  -- Make sure when event ends all tiny screns get a relevant message
  -- Governor should get a pardoned/denied resolution message.
  -- Add seer statements on resolve
- Clean up display for werewolf packsense.
- Add suspect functionality.
- Add slide to game end that shows score including suspect.
