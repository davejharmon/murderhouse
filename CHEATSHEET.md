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
| **Citizens** | All Children are dead |
| **Children** | Children equal or outnumber Citizens |
| **Trickster** | Get yourself voted out during the day |

---

## Teams

| Team | Goal |
|------|------|
| **Citizens** | Find and eliminate all Children |
| **Children** | Kill enough Citizens to equal or outnumber them |
| **Outsiders** | Personal win condition (see role) |

---

## Roles

### Citizens (Town)

| Role | Night Action | Notes |
|------|-------------|-------|
| **Citizen** | Suspect a player | No special powers. Vote by day, suspect by night. Backbone of the Citizens. |
| **Detective** | Investigate a player | Learn if target is **CHILD** or **NOT CHILD**. Beware: the Marked appears as a Child. |
| **Doctor** | Protect a player | Target is saved from one kill that night. Can protect self. |
| **Paranoid** | Suspect a player | No night power, but on death (any cause) gets a **revenge shot** — picks one player to take with them. |
| **Vigilante** | Shoot a player | Kills target at night (one-time use). Can be blocked by Doctor protection. Friendly fire is permanent. |
| **Governor** | None (vote only) | Holds the **Gavel**. After a vote condemns someone, can **pardon** them once per game. |
| **Lover** | Link two lovers (setup only) | At game start, chooses 2 players to be **linked**. If one lover dies, the other dies too. |
| **Jailer** | Jail a player | Target is both **protected** and **roleblocked** for that night. Cannot jail self. |
| **Marked** | Suspect a player | Thinks they're a Citizen, but **appears guilty** when investigated. A Citizen the town may accidentally eliminate. |
| **Wildcard** | "Investigate" a player | Thinks they're a Detective, but their action is **random**: 25% real investigate, 25% kill, 25% protect, 25% block. Always shown a result as if they investigated. |

### Children (Mafia)

| Role | Night Action | Notes |
|------|-------------|-------|
| **Elder** | Choose a kill target | Leader of the Children. If the Elder dies, a living Child is **promoted** (Children first). |
| **Child** | Suggest a target | Suggests targets to the Elder. Cannot directly choose the kill. Knows their packmates. |
| **Silent** | Block a player's ability | Prevents one player's night action from working. Resolves first. |
| **Bitter** | Activate poison (yes/no) | Instead of the normal kill, the target is **poisoned** — dies at the end of the *next* night. Doctor can prevent if protecting the same night. |
| **Hidden** | Activate cover-up (yes/no) | When the Children kill someone that night, the victim's **role is hidden** on the death reveal. |

### Outsiders

| Role | Night Action | Notes |
|------|-------------|-------|
| **Trickster** | None (vote only) | **Wins if voted out** during the day. Getting killed at night does NOT count. |

---

## Items

| Item | Uses | Effect |
|------|------|--------|
| **Pistol** | 1 | Shoot and kill any player during the day. Immediate, no vote needed. |
| **Gavel** | 1 | After a vote condemns someone, you can **pardon** them. Given to the Governor. |
| **Clue** | 1 | One investigation, like the Detective. Learn if a target is CHILD or NOT CHILD. |
| **Warden** | Permanent | Jail one player each night — they are protected and roleblocked. Like a permanent Jailer. |
| **Syringe** | 1 | Poison a player at night. They die when next night's events resolve. |
| **Hardened** | 1 | Survive one Children kill attempt. The attack is silently absorbed — nobody knows it happened. |
| **Coward** | Permanent | Cannot be targeted by anything. Also cannot participate in events. Untouchable but powerless. |

Some items are **hidden** — the holder doesn't know they have them:

| Item | Effect |
|------|--------|
| **Marked** | Appear guilty when investigated. |
| **Prospect** | If killed by the Children, join the Children instead of dying. |
| **No Vote** | Cannot participate in the next elimination vote. |
| **Poisoned** | A slow-acting toxin. Die when next night's events resolve. |

---

## Role Composition by Player Count

| Players | Children | Citizen Specials | Citizens |
|---------|----------|-----------------|----------|
| **4** | Elder | Detective | 2 |
| **5** | Elder | Detective | 3 |
| **6** | Elder | Detective, Doctor | 3 |
| **7** | Elder, Child | Detective, Doctor | 3 |
| **8** | Elder, Child | Detective, Doctor, Vigilante | 3 |
| **9** | Elder, Child, Silent | Detective, Doctor, Vigilante, Paranoid | 2 |
| **10** | Elder, Child, Silent | Detective, Doctor, Vigilante, Paranoid, Governor | 2 |

---

## Night Resolution Order

Actions resolve top-to-bottom. Earlier actions take effect before later ones.

1. **Jailer Jail** — target is protected and roleblocked for the night
2. **Silent Block** — roleblock applied
3. **Doctor Protect** — protection shield set
4. **Investigate / Wildcard Stumble** — Detective and Wildcard act
5. **Vigilante Shot / Syringe Inject** — independent night kill or poison application
6. **Child Suggest** — target suggestions recorded
7. **Hidden Cover-up** — armed for this night's kill
8. **Bitter Poison** — poison replaces the normal kill
9. **Children Kill** — Elder's chosen target dies (or is poisoned/protected)
10. **Suspect** — Citizens, Marked, Paranoid, Governor record suspicions

---

## Tips

- **Children know each other.** Citizens don't know anyone's role.
- **Dead players' roles are revealed** on the big screen (unless the Hidden Child covers it up).
- **Linked lovers** (from the Lover) die together — be careful who you trust.
- **Voting ties** go to a runoff. Two failed runoffs deadlock — no one is eliminated.
- **The Trickster wins even if their team loses** — they just need to get voted out.
