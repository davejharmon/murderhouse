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
