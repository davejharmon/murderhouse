# Physical Display Format Proposal (256x64)

## Proposed Compact Format

```json
{
  "compact": {
    "role": "ALPHA", // Role name (no emoji)
    "event": "KILL A PLAYER", // Event tip / "KILL Player 3" / null
    "target": "Player 5", // Current selection (or null)
    "status": "LOCKED", // null / "LOCKED" / "ABSTAINED"
    "packSuggest": "Player 3", // Most popular pack choice (during event)
    "packMembers": ["Player 2", "Player 8"] // Pack member names (when idle)
  }
}
```

## Example Renders

### Start of phase (idle)

```
DAY 1
ALPHA
Lead the pack, kill at night
```

### During VOTE Event - Selecting

```
DAY 1 › VOTE
SELECT PLAYER | PLAYER 3 | DEMI
Choose who to eliminate | Selection locked in
```

### During GOVERNOR Event - Pardon

```
DAY 1 › PARDON
PLAYER 9
YES to confirm • NO to abstain
```

### During Kill Event - Locked

```
DAY 1 › KILL › :PACK: DEMI  :phone:
SELECT PLAYER | PLAYER 3 | DEMI
Choose who to eliminate | Selection locked in
```

### Seer investigation

```
DAY 1 › INVESTIGATE
SELECT PLAYER
Learn a player's team
```

```
DAY 1 › INVESTIGATE
DEMI IS A WEREWOLF | VILLAGER | INDEPENDENT
Don't forget it
```

### Inventory (when idle)

```
DAY 1                     :pistol:
PISTOL
Shoot a player • 1/1 uses
```

### Inventory (when used)

```
DAY 1 › SHOOT                    :pistol:
SELECT PLAYER
Choose who to eliminate
```

```
DAY 1 › INVESTIGATE
SELECT PLAYER
Learn a player's team
```

```
DAY 1 › INVESTIGATE
DEMI IS A WEREWOLF | VILLAGER | INDEPENDENT
Don't forget it
```

## Implementation Plan

1. Add `COMPACT_DISPLAY` constant flag to `shared/constants.js`
2. Add `getCompactDisplay(game)` method to Player.js
3. Include in `getPrivateState()` when `COMPACT_DISPLAY` is true
4. Web UI ignores `compact` field, uses existing fields
5. Physical device uses `compact` field only

## Code Changes Required

**shared/constants.js:**

```js
export const COMPACT_DISPLAY = true; // Toggle for physical device mode
```

**server/Player.js:**

```js
getCompactDisplay(game) {
  // Calculate pack suggest (most popular target)
  // Calculate pack members
  // Return compact object
}

getPrivateState(game) {
  const state = { /* existing fields */ };

  if (COMPACT_DISPLAY) {
    state.compact = this.getCompactDisplay(game);
  }

  return state;
}
```

This approach keeps both UIs working without breaking changes.
