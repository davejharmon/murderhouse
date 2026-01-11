# Physical Display Format Proposal (256x64 OLED)

## Hardware Specifications

- **Display**: 256x64 monochrome OLED
- **Navigation**: Mechanical rotary 8-position switch (sends increment/decrement signals)
- **Buttons**: Physical LED arcade buttons (YES/NO with LED feedback)
- **Platform**: ESP32-based terminals with WebSocket connection

## Display Format: Three-Line Layout

All display states follow a consistent three-line format:

```
[LINE 1] Small - Context: role, event, phase, glyphs
[LINE 2] BIG   - Primary content: selection, status, action
[LINE 3] Small - Tutorial tip or status info
```

### Character Budget (256px width)
- Line 1 (small): ~32 characters + glyphs
- Line 2 (large): ~16 characters
- Line 3 (small): ~32 characters

## Glyph System

Inline glyphs for compact display. Physical displays render as bitmap icons, React renders as emoji/text.

| Glyph ID | Physical | React | Meaning |
|----------|----------|-------|---------|
| `:pistol:` | gun icon | `*` | Pistol item |
| `:phone:` | phone icon | `$` | Phone item |
| `:crystal:` | orb icon | `@` | Crystal Ball |
| `:wolf:` | wolf icon | `W` | Werewolf team |
| `:village:` | house icon | `V` | Village team |
| `:lock:` | lock icon | `!` | Selection locked |
| `:check:` | checkmark | `+` | Confirmed |
| `:x:` | X mark | `-` | Abstained |
| `:alpha:` | crown | `A` | Alpha werewolf |
| `:pack:` | pawprint | `P` | Pack suggestion |

## Display State Schema

Server sends this to clients. React interprets for web UI, ESP interprets for OLED.

```typescript
interface DisplayState {
  line1: {
    left: string;      // "NIGHT 2" or "DAY 1 > VOTE"
    right: string;     // ":pistol: :phone:" glyph string
  };
  line2: {
    text: string;      // "PLAYER 3" or "SELECT TARGET"
    style: 'normal' | 'locked' | 'abstained' | 'waiting';
  };
  line3: {
    text: string;      // "YES to confirm" or "Swipe to select"
  };
  leds: {
    yes: 'off' | 'dim' | 'bright' | 'pulse';
    no: 'off' | 'dim' | 'bright' | 'pulse';
  };
}
```

## Example Display States

### Lobby - Waiting
```
LOBBY
WAITING FOR GAME
Game will begin soon
```

### Idle - Day Phase (Villager with Pistol)
```
DAY 1                     :pistol:
VILLAGER
Discuss and vote
```

### Idle - Night Phase (Alpha Werewolf)
```
NIGHT 1              :alpha::wolf:
LEAD THE PACK
Wait for kill event
```

### Event Active - Selecting Target
```
DAY 1 > VOTE
PLAYER 3
YES confirm • NO abstain
```

### Event Active - No Selection Yet
```
DAY 1 > VOTE
SELECT TARGET
Swipe to choose
```

### Selection Locked
```
DAY 1 > VOTE              :lock:
PLAYER 3
Selection locked
```

### Abstained
```
DAY 1 > VOTE                 :x:
ABSTAINED
Waiting for others
```

### Pack Kill - With Pack Suggestion
```
NIGHT 1 > KILL      :pack: DEMI
PLAYER 5
Pack suggests Demi
```

### Seer Investigation Result
```
NIGHT 1 > INVESTIGATE
DEMI IS EVIL
Remember this info
```

### Governor Pardon Prompt
```
DAY 1 > PARDON
PLAYER 7
YES pardon • NO execute
```

### Ability Mode - Pistol Selected
```
DAY 1                     :pistol:
USE PISTOL?
YES to shoot • Swipe for more
```

### Dead - Spectator
```
ELIMINATED
SPECTATOR MODE
Watch the game unfold
```

### Hunter Revenge (Dead but Active Event)
```
REVENGE                   :skull:
PLAYER 2
Take someone with you
```

## Implementation Plan

### Phase 1: Abstract Display State (Server)

1. **Add `getDisplayState()` to Player.js**
   ```js
   getDisplayState(game) {
     return {
       line1: { left: this.getContextLine(game), right: this.getGlyphLine() },
       line2: { text: this.getPrimaryLine(game), style: this.getLineStyle() },
       line3: { text: this.getTutorialLine(game) },
       leds: this.getLedState(game),
     };
   }
   ```

2. **Include in `getPrivateState()`**
   ```js
   getPrivateState(game) {
     return {
       ...existingFields,
       display: this.getDisplayState(game),
     };
   }
   ```

3. **Add glyph helper methods**
   ```js
   getInventoryGlyphs() {
     return this.inventory
       .filter(i => i.uses > 0)
       .map(i => `:${i.id}:`)
       .join('');
   }
   ```

### Phase 2: TinyScreen Component (React)

1. **Create `TinyScreen.jsx`** - Dedicated three-line display component
   ```jsx
   function TinyScreen({ display }) {
     return (
       <div className={styles.tinyScreen}>
         <div className={styles.line1}>
           <span className={styles.left}>{display.line1.left}</span>
           <span className={styles.right}>{renderGlyphs(display.line1.right)}</span>
         </div>
         <div className={`${styles.line2} ${styles[display.line2.style]}`}>
           {display.line2.text}
         </div>
         <div className={styles.line3}>
           {display.line3.text}
         </div>
       </div>
     );
   }
   ```

2. **Glyph renderer for React**
   ```jsx
   const GLYPH_MAP = {
     ':pistol:': '*',
     ':phone:': '$',
     ':crystal:': '@',
     ':wolf:': 'W',
     ':lock:': '!',
     // ... etc
   };

   function renderGlyphs(str) {
     return str.replace(/:(\w+):/g, (match) => GLYPH_MAP[match] || match);
   }
   ```

3. **Update PlayerConsole.jsx** to use `display` prop from server instead of computing locally

### Phase 3: Simplify PlayerConsole

1. **Remove local state computation** - Server now provides display state
2. **Keep button logic** - Still need to handle clicks/navigation
3. **Pass display state to TinyScreen** - Single source of truth

### Phase 4: ESP32 Integration Protocol

1. **Simplified WebSocket message for ESP**
   ```js
   // Server sends only what ESP needs
   {
     type: 'DISPLAY',
     payload: {
       lines: ['DAY 1 > VOTE', 'PLAYER 3', 'YES confirm'],
       glyphs: [0, 0, 1, 0], // Bitmap glyph positions
       leds: { yes: 2, no: 1 }, // 0=off, 1=dim, 2=bright, 3=pulse
     }
   }
   ```

2. **ESP sends only input events**
   ```js
   { type: 'ROTATE', direction: 1 }  // 1=up, -1=down
   { type: 'BUTTON', id: 'yes' }
   { type: 'BUTTON', id: 'no' }
   ```

3. **Map existing ClientMsg to ESP inputs**
   - `ROTATE +1` → `SELECT_UP`
   - `ROTATE -1` → `SELECT_DOWN`
   - `BUTTON yes` → `CONFIRM` or `USE_ITEM`
   - `BUTTON no` → `ABSTAIN`

### Phase 5: LED Feedback System

Button LEDs indicate available actions:

| State | YES LED | NO LED |
|-------|---------|--------|
| Idle, no abilities | off | off |
| Idle, has ability | dim | off |
| Event, no selection | off | dim (if can abstain) |
| Event, has selection | bright | dim |
| Locked/Abstained | off | off |
| Waiting for event | pulse | off |

## File Changes Summary

| File | Changes |
|------|---------|
| `server/Player.js` | Add `getDisplayState()`, update `getPrivateState()` |
| `shared/constants.js` | Add `GLYPH_IDS` mapping |
| `client/components/TinyScreen.jsx` | New component for 3-line display |
| `client/components/TinyScreen.module.css` | Styling for monospace 3-line layout |
| `client/components/PlayerConsole.jsx` | Use `display` from props, delegate to TinyScreen |
| `client/components/GlyphRenderer.jsx` | Helper to render glyph strings |

## Testing Strategy

1. **React Console** - Full testing with visual display, click buttons
2. **Debug Grid** - 9-player view for testing all states simultaneously
3. **ESP Simulator** - Future: browser-based ESP display simulator
4. **Physical Prototype** - Single ESP32 + OLED for hardware validation

## Migration Path

1. Server always sends `display` object in player state
2. React initially ignores it, uses existing logic
3. Switch React to use `display` object
4. Remove redundant client-side display computation
5. ESP clients connect and receive same `display` object
6. Both platforms work from single source of truth

## Open Questions

1. Should pack member selections show on line 3 or separate display mode?
2. How to handle investigation history (multiple results)?
3. Glyph limit per line? (Suggest max 4 glyphs on line 1 right side)
4. Should dead players see different content or blank screen?
