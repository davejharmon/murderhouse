# Operator Terminal Feature Plan

## Overview
A shared `/operator` terminal for dead players to compose cryptic messages from a fixed word library. The host sees the live message and can send it as a big-screen slide.

---

## Word Library (`shared/constants.js`)

```js
export const OperatorCategory = {
  WARNINGS: 'WARNINGS',
  SUBJECTS:  'SUBJECTS',
  STATE:     'STATE',
  CHAOS:     'CHAOS',
  READY:     'READY',   // special — not a word category
}

export const OPERATOR_WORDS = {
  WARNINGS: ['BEWARE','TRUST','IGNORE','WATCH','LISTEN','REMEMBER','FORGET','SUSPECT'],
  SUBJECTS:  ['THE','LOUD','QUIET','KIND','SCARED','ANGRY','CLEVER','COWARDLY','BRAVE',
               'BLESSED','LUCKY','UNLUCKY','LEFT','RIGHT','MEAN','SHOUTY','STRANGE',
               'ONE','THEM','ALL','NONE','FIRST','LAST'],
  STATE:     ['LIES','KNOWS','HIDES','PROTECTS','HUNTS','IS','NOT','SOON','LATE','TOO',
               'SAFE','LOST','WRONG','STUPID','LYING','CRAZY','WILL','DIE','LIVE',
               'WIN','LOSE','NEXT','WANTS','HATES','THIS','THAT','CHANGES','STARTS','ENDS'],
  CHAOS:     ['YIKES','SORRY','BYE','HELLO','HELP','NO','YES','MAYBE','RED','DARK',
               'SOON','ALWAYS','NEVER','DAVE'],
}

// Category order for dial cycling
export const OPERATOR_CATEGORIES = ['WARNINGS','SUBJECTS','STATE','CHAOS','READY']
```

New message types added to `ServerMsg` and `ClientMsg`.

---

## New Message Types (`shared/constants.js`)

```js
// Client → Server
ClientMsg.OPERATOR_JOIN     // connects as operator (no playerId)
ClientMsg.OPERATOR_ADD      // { word: string }  — add word to message
ClientMsg.OPERATOR_DELETE   // {}               — delete last word
ClientMsg.OPERATOR_READY    // {}               — mark message ready
ClientMsg.OPERATOR_UNREADY  // {}               — go back to editing
ClientMsg.OPERATOR_SEND     // {} (host only)   — push slide, clear message

// Server → All clients
ServerMsg.OPERATOR_STATE    // { words: string[], ready: boolean }
```

---

## Server: Game.js

Add to game state:
```js
this.operatorWords = []    // string[]
this.operatorReady = false
```

New methods:
- `operatorAdd(word)` — push word, broadcast
- `operatorDelete()` — pop word, broadcast
- `operatorSetReady(ready)` — set flag, broadcast
- `operatorSend()` — push slide, clear state, broadcast
- `broadcastOperatorState()` — sends `OPERATOR_STATE` to all connections
- `operatorSend()` creates a slide:
  ```js
  {
    type: 'operator',
    title: 'A MESSAGE FROM BEYOND...',
    words: [...this.operatorWords],
    style: SlideStyle.NEUTRAL,
  }
  ```

---

## Server: handlers/index.js

New handlers (no auth guard — open):
```js
[ClientMsg.OPERATOR_JOIN]: (ws) => {
  ws.clientType = 'operator'
  send(ws, ServerMsg.OPERATOR_STATE, game.getOperatorState())
}
[ClientMsg.OPERATOR_ADD]:    (ws, { word }) => game.operatorAdd(word)
[ClientMsg.OPERATOR_DELETE]: ()              => game.operatorDelete()
[ClientMsg.OPERATOR_READY]:  ()              => game.operatorSetReady(true)
[ClientMsg.OPERATOR_UNREADY]:()              => game.operatorSetReady(false)
[ClientMsg.OPERATOR_SEND]:   (ws)            => {
  if (ws.clientType !== 'host') return
  game.operatorSend()
}
```

---

## Client: GameContext.jsx

Add `operatorState` to context:
```js
const [operatorState, setOperatorState] = useState({ words: [], ready: false })

case ServerMsg.OPERATOR_STATE:
  setOperatorState(payload)
  break
```

Expose `operatorState` and `sendMessage` in context value.

---

## Client: Operator.jsx (new page)

### Own WebSocket
Operator.jsx maintains its own `useRef` WebSocket (not GameContext). Connects on mount, sends `OPERATOR_JOIN`, handles `OPERATOR_STATE` to detect when message clears (host sent it).

### State
```js
layer:         'category' | 'word' | 'ready'
categoryIndex: number   // dial position in OPERATOR_CATEGORIES
wordIndex:     number   // dial position in current category's word list
words:         string[] // local copy, synced from server OPERATOR_STATE
```

### Input Layer 1 — Category
| Action | Effect |
|--------|--------|
| Dial ↑/↓ | Move `categoryIndex` |
| YES | If READY → send OPERATOR_READY, enter `ready` layer. Else enter `word` layer |
| NO | Send OPERATOR_DELETE (remove last word) |

### Input Layer 2 — Word
| Action | Effect |
|--------|--------|
| Dial ↑/↓ | Move `wordIndex` |
| YES | Send OPERATOR_ADD(word), return to category layer |
| NO | Return to category layer (no change) |

### Ready State
- Shows full message + "WAITING FOR HOST..."
- NO → send OPERATOR_UNREADY, return to category layer

### Display
Three-zone layout matching TinyScreen aesthetic but full-page web:
```
┌─────────────────────────────┐
│  [built message scrolling]  │  ← top, small mono text, builds up
├─────────────────────────────┤
│                             │
│   CURRENT SELECTION         │  ← large central focus text
│   (category or word)        │
│                             │
├─────────────────────────────┤
│  [YES: action] [NO: action] │  ← bottom button labels
└─────────────────────────────┘
```
- Dark background, amber/green CRT palette
- Message area: dim, small — the words accumulate
- Selection area: bright, large
- Keyboard support: Arrow Up/Down = dial, Enter = YES, Escape/Backspace = NO

---

## Client: Host.jsx

New "Operator" section in host dashboard:
- Shows live `operatorState.words` as a constructed sentence
- When `operatorReady: true`: highlight panel, show **SEND TO SCREEN** button
- When `operatorReady: false`: show **[COMPOSING...]** status, greyed-out button
- SEND button calls `sendMessage(ClientMsg.OPERATOR_SEND, {})`

---

## Client: Screen.jsx — `renderOperator(slide)`

New slide type `'operator'`:
- Background: near-black with subtle vignette, slightly different from normal deathSlide
- Title: `"A MESSAGE FROM BEYOND..."` — small caps, dim, letter-spaced, slow fade-in
- Message: the words joined with spaces, rendered large, dramatic, monospace
  - Each word fades in sequentially via CSS animation (staggered `animation-delay`)
  - Pale white / off-white text, high letter-spacing
- No portrait, no gallery

---

## Client: App.jsx

Add route:
```jsx
<Route path="/operator" element={<Operator />} />
```
(No GameProvider dependency — Operator manages its own WS.)
Actually keep inside GameProvider so routing works, but Operator won't use the context.

---

## Files Changed

| File | Change |
|------|--------|
| `shared/constants.js` | `OPERATOR_WORDS`, `OPERATOR_CATEGORIES`, new `ServerMsg`/`ClientMsg` keys |
| `server/Game.js` | `operatorWords`, `operatorReady`, operator methods, `broadcastOperatorState` |
| `server/handlers/index.js` | 5 new operator handlers |
| `client/src/context/GameContext.jsx` | `operatorState` state + `OPERATOR_STATE` handler |
| `client/src/App.jsx` | `/operator` route |
| `client/src/pages/Operator.jsx` | New page (own WS, two-layer dial UI) |
| `client/src/pages/Operator.module.css` | New styles |
| `client/src/pages/Host.jsx` | Operator live feed + send button |
| `client/src/pages/Screen.jsx` | `renderOperator()` + route in `renderSlide()` |
| `client/src/pages/Screen.module.css` | Operator slide styles |

---

## Open Questions / Assumptions
- Max message length: no hard limit enforced (host can just not send a bad one)
- If operator disconnects mid-composition: server state persists (words stay)
- Multiple operator tabs: all see the same state, any can add/delete (shared terminal)
- Keyboard controls on Operator page: ↑/↓ arrows = dial, Enter = YES, Backspace = NO
