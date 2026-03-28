# Murderhouse — Player Cheat Sheet

## How to Play

Each player uses a personal terminal (phone or ESP32 device) with a 3-line display:

- **Line 1**: Context (your player number, role, current phase)
- **Line 2**: Main content (target name, action result)
- **Line 3**: Instructions (what the buttons do)

### Terminal Controls

| Button | Function |
|--------|----------|
| **YES** (yellow) | Confirm selection, submit action |
| **NO** (red) | Go back, decline, abstain |
| **UP / DOWN** | Scroll through targets or actions |

- When your button LEDs are **off**, there's nothing to do — wait for the next phase.
- When you have **multiple actions** available (e.g. a night ability + an item), you'll see an action selection screen first. Scroll to pick which ability to use, then pick your target.
- **Abstaining**: Press NO when prompted to skip your action for the round.

### Game Flow

1. **Lobby** — Players join and ready up.
2. **Role Reveal** — You're privately shown your role. Memorize it.
3. **Day Phase** — Discuss, accuse, and vote to eliminate a suspect. Pistols can be fired.
4. **Night Phase** — Use your night ability (if you have one). Actions resolve in priority order.
5. **Repeat** until one team wins.

### Win Conditions

| Team | Condition |
|------|-----------|
| **Circle** | All Cell members are dead |
| **Cell** | Cell members equal or outnumber Circle |
| **Jester** | Get yourself voted out during the day |

---

## Teams

| Team | Goal |
|------|------|
| **Circle** | Find and eliminate all Cell members |
| **Cell** | Kill enough Circle members to equal or outnumber them |
| **Neutral** | Personal win condition (see role) |

---

## Roles

### Circle (Town)

| Role | Night Action | Notes |
|------|-------------|-------|
| **Nobody** | Suspect a player | No special powers. Vote by day, suspect by night. Backbone of the Circle. |
| **Seeker** | Investigate a player | Learn if target is **CELL** or **NOT CELL**. Beware: the Marked appears as CELL. |
| **Medic** | Protect a player | Target is saved from one kill that night. Can't protect the same person two nights in a row. Can protect self. |
| **Hunter** | Suspect a player | No night power, but on death (any cause) gets a **revenge shot** — picks one player to take with them. |
| **Vigilante** | Shoot a player | Kills target at night (one-time use). Can be blocked by Medic protection. Friendly fire is permanent. |
| **Judge** | None (vote only) | Holds the **Gavel**. After a vote elimination, can **pardon** the condemned player once per game. |
| **Cupid** | Link two lovers (setup only) | At game start, chooses 2 players to be **linked**. If one lover dies, the other dies too. |
| **Marked** | Suspect a player | Thinks they're a Nobody, but **appears guilty** when investigated. A Circle member the town may accidentally lynch. |
| **Amateur** | "Investigate" a player | Thinks they're a Seeker, but their action is **random**: 25% real investigate, 25% kill, 25% protect, 25% block. Always shown a result as if they investigated. |

### Cell (Mafia)

| Role | Night Action | Notes |
|------|-------------|-------|
| **Alpha** | Choose a kill target | Leader of the Cell. If the Alpha dies, a living Cell member is **promoted** (Sleepers first). |
| **Sleeper** | Suggest a target | Cell member who suggests targets to the Alpha. Cannot directly choose the kill. Knows their packmates. |
| **Handler** | Block a player's ability | Prevents one player's night action from working. Resolves first. |
| **Chemist** | Activate poison (yes/no) | Instead of the normal kill, the target is **poisoned** — dies at the end of the *next* night. Medic can prevent if protecting the same night. |
| **Fixer** | Activate cover-up (yes/no) | When the Cell kills someone that night, the victim's **role is hidden** on the death reveal. |

### Neutral

| Role | Night Action | Notes |
|------|-------------|-------|
| **Jester** | None (vote only) | **Wins if voted out** during the day. Getting killed at night does NOT count. |

---

## Items

| Item | Type | Uses | Effect |
|------|------|------|--------|
| **Pistol** | Active (Day) | 1 | Shoot and kill any player during the day. Immediate, no vote needed. |
| **Gavel** | Passive | 1 | After a vote condemns someone, you can **pardon** them. Given to the Judge. |
| **Clue** | Active (Night) | 1 | One investigation, like the Seeker. Learn if a target is CELL or NOT CELL. |
| **Hardened** | Passive | 1 | Survive one Cell kill attempt. The attack is silently absorbed — nobody knows it happened. |
| **Coward** | Passive | Permanent | Cannot be targeted by anything. Also cannot participate in events. Untouchable but powerless. |

Some items are **hidden** — the holder doesn't know they have them:

| Item | Effect |
|------|--------|
| **Marked** | Appear guilty when investigated. |
| **Prospect** | If killed by the Cell, join the Cell instead of dying. |
| **No Vote** | Cannot participate in the next elimination vote. |

---

## Role Composition by Player Count

| Players | Cell | Circle Specials | Nobodies |
|---------|------|----------------|----------|
| **4** | Alpha | Seeker | 2 |
| **5** | Alpha | Seeker | 3 |
| **6** | Alpha | Seeker, Medic | 3 |
| **7** | Alpha, Sleeper | Seeker, Medic | 3 |
| **8** | Alpha, Sleeper | Seeker, Medic, Vigilante | 3 |
| **9** | Alpha, Sleeper, Handler | Seeker, Medic, Vigilante, Hunter | 2 |
| **10** | Alpha, Sleeper, Handler | Seeker, Medic, Vigilante, Hunter, Judge | 2 |

---

## Night Resolution Order

Actions resolve top-to-bottom. Earlier actions take effect before later ones.

1. **Handler Block** — roleblock applied first
2. **Medic Protect** — protection shield set
3. **Investigate / Amateur Stumble** — Seeker and Amateur act
4. **Sleeper Hunt** — target suggestions
5. **Vigilante Shot** — independent night kill
6. **Fixer Cover-up** — armed for this night's kill
7. **Chemist Poison** — poison replaces the normal kill
8. **Cell Kill** — Alpha's chosen target dies (or is poisoned/protected)
9. **Suspect** — Nobodies, Marked, Hunter, Judge record suspicions

---

## Tips

- **Cell members know each other.** Circle members don't know anyone's role.
- **Dead players' roles are revealed** on the big screen (unless the Fixer covers it up).
- **Linked lovers** (from Cupid) die together — be careful who you trust.
- **The Medic can't protect the same person twice in a row**, so vary your protection.
- **Voting ties** go to a runoff. After 3 tied runoffs, the winner is chosen randomly.
- **The Jester wins even if their team loses** — they just need to get voted out.
