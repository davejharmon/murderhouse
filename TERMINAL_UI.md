# TinyScreen UI/UX Guide

Design reference for the web player terminal UI. The web player view (`/player/x` and `/debug`) faithfully reproduces the ESP32 physical terminal: an amber monochrome SSD1322 OLED, two arcade buttons with LEDs, a rotary encoder, a neopixel status indicator, and a power LED.

---

## Physical Hardware Reference

```
PCB Component Map (player-visible):

  [D1 PWR]  [NEOPIXEL]         #3 BEN        ← Indicator LEDs + label
  ┌──────────────────────────────────────┐
  │  #3 WEREWOLF > NIGHT 1 > HUNT  :wolf:│    ← Line 1 (context)
  │                                      │
  │          ┌─────────┐                 │
  │          │ PLAYER 5 │                 │    ← Line 2 (main, locked frame)
  │          └─────────┘                 │
  │                                      │
  │  KILL                      ABSTAIN   │    ← Line 3 (button labels)
  └──────────────────────────────────────┘
      [▲]  [▼]            [YES]  [NO]         ← Controls
       encoder             arcade buttons
```

| Component | Hardware | Web Equivalent | File |
|-----------|----------|----------------|------|
| OLED display | SSD1322 256x64 amber | `<TinyScreen>` (canvas) | TinyScreen.jsx/module.css |
| YES button | Arcade w/ yellow LED | `<button class="yesButton">` | PlayerConsole.jsx/module.css |
| NO button | Arcade w/ red LED | `<button class="noButton">` | PlayerConsole.jsx/module.css |
| Rotary encoder | EC11 w/ detents | `<button class="navButton">` x2 | PlayerConsole.jsx/module.css |
| Neopixel | WS2811 RGB on GPIO 8 | `<StatusLed>` | StatusLed.jsx/module.css |
| Power LED | D1 yellow, 5V rail | `<div class="powerLed">` | PlayerConsole.module.css |

---

## Color Palette

### OLED Amber (TinyScreen)

The OLED is monochrome amber. All screen content uses shades of amber — never white, blue, green, or any other hue.

```
--oled-amber:        #ffb000    Full brightness — line2 text, line1 right glyphs
--oled-amber-bright: #ffc840    Boosted — LOCKED emphasis (line2, locked frame)
--oled-amber-dim:    #805800    ~50% — line1 left, line3, muted/abstained content
--oled-amber-faint:  #403000    ~25% — borders, subtle elements
--oled-bg:           #0a0800    Warm near-black — screen background
```

Defined in `client/src/styles/global.css` under `:root`.

### Button LED Colors (PlayerConsole)

Buttons use their own color families — yellow for YES, red for NO. These are the LED colors of the physical arcade buttons, not OLED amber.

```
YES (yellow): rgba(230, 168, 0, ...)   — #e6a800 at full
NO  (red):    rgba(239, 68, 68, ...)   — #ef4444 at full
```

### Indicator LEDs

```
Power LED (D1):  #e6a800                — yellow, always on
Neopixel:        Per-state RGB          — see StatusLed states below
```

### Console Background

```
#0d0d0d    PlayerConsole background (panel surface, not OLED)
```

---

## Layout Structure

```
PlayerConsole (.console)
├── Indicators (.indicators)
│   ├── Power LED (.powerLed)           — D1, always-on yellow dot
│   ├── StatusLed                       — Neopixel, server-driven color
│   └── Player Label (.playerLabel)     — "#3 BEN", centered, host QoL
│
├── TinyScreen (.screen)                — OLED display simulation (canvas)
│   └── <canvas 256x64>                 — Bitmap font rendering, pixelated scaling
│
└── Controls (.controls)
    └── Button Row (.buttonRow)
        ├── ▲ Nav (.navButton)          — Rotary encoder up
        ├── ▼ Nav (.navButton)          — Rotary encoder down
        ├── YES (.yesButton)            — Yellow LED arcade button
        └── NO (.noButton)              — Red LED arcade button
```

### Compact Mode (`/debug` grid)

When `compact={true}`, the console shrinks for the 3x3 debug grid. The canvas scales down proportionally via CSS `width: 100%` with `image-rendering: pixelated` preserving the pixel grid appearance.

| Element | Normal | Compact |
|---------|--------|---------|
| Console height | 100dvh | auto |
| Console padding | 1rem | 6px |
| Power LED | 8px | 5px |
| Player label | 0.8rem | 0.8rem |
| Canvas | 256x64 native, full width | 256x64 native, smaller container |
| Buttons | 48px | 32px |

---

## TinyScreen — The OLED Display

### Canvas-Based Rendering

The TinyScreen renders to an HTML `<canvas>` at the native 256x64 pixel resolution of the physical SSD1322 OLED. The canvas is scaled up via CSS `width: 100%` with `image-rendering: pixelated` / `crisp-edges`, producing a visible pixel grid that matches the physical display's appearance.

Text is rendered using bitmap font data extracted from the X.org misc-fixed font collection — the same source that U8G2 uses on the ESP32:

| Font | U8G2 name | Usage | Source |
|------|-----------|-------|--------|
| `FONT_6x10` | `u8g2_font_6x10_tf` | Lines 1 and 3 (small context text) | `6x10.bdf` from xorg/font/misc-misc |
| `FONT_10x20` | `u8g2_font_10x20_tf` | Line 2 (large main content) | `10x20.bdf` from xorg/font/misc-misc |

Font data is stored in `oledFonts.js` as JavaScript arrays of bitmap row data.

### Three-Line Format

Every screen state renders exactly three lines. This constraint matches the physical 256x64 OLED, which has room for one small line, one large line, and one small line.

Layout constants (matching ESP32 `display.cpp`):
```
LINE1_Y = 12   (baseline)    MARGIN_X = 4
LINE2_Y = 42   (baseline)
LINE3_Y = 60   (baseline)
```

#### Line 1 — Context (FONT_6x10, dim amber)

| Side | Content | Examples |
|------|---------|----------|
| Left | Player context: seat, role, phase, action | `#3 WEREWOLF > NIGHT 1 > HUNT` |
| Right | Inventory/status glyphs | `:wolf: :pistol:`, `:skull:`, `:lock:` |

#### Line 2 — Main Content (FONT_10x20, bright amber)

The primary focus. Always uppercase, centered.

| Context | Text | Style |
|---------|------|-------|
| Lobby | `WAITING` | normal |
| Game over | `FINISHED` | normal |
| Dead | `SPECTATOR` | normal |
| Event, no selection | `SELECT TARGET` | waiting |
| Event, has selection | `{TARGET_NAME}` | normal |
| Selection confirmed | `{TARGET_NAME}` | locked |
| Abstained | `ABSTAINED` | abstained |
| Ability prompt | `USE PISTOL?` | normal |
| Idle (has role) | `{ROLE_NAME}` | normal |
| Idle (no role) | `READY` | normal |

#### Line 3 — Instructions (FONT_6x10, dim amber)

Two layout modes:

**Centered text** — Status tips, no buttons active:
```
"Game will begin soon" | "Thanks for playing" | "Selection locked"
```

**Split labels** — Button labels, left=YES right=NO:
```
Left: "VOTE"     Right: "ABSTAIN"
Left: "KILL"     Right: "ABSTAIN"
Left: "PARDON"   Right: "CONDEMN"
Left: "USE (1/2)" Right: ""
Left: "Use dial"  Right: "ABSTAIN"
```

### Display Styles

Line2's `style` field drives the entire screen variant:

#### Normal (default)
```
Bezel border: 1px solid var(--oled-amber-faint)
Canvas text:  #ffb000 (COLOR_NORMAL)
```
The default resting state. Warm amber text on near-black.

#### Locked
```
Bezel border: var(--oled-amber)
Canvas text:  #ffc840 (COLOR_BRIGHT)
Canvas frame: 1px rectangle around line2 text (matching ESP32 drawFrame)
```
Selection confirmed. Bezel brightens. Line2 text drawn in brighter amber with a pixel-perfect rectangle frame.

#### Abstained
```
Canvas text: #805800 (COLOR_DIM)
```
Player passed. All canvas text draws in dim amber.

#### Waiting
```
Bezel: CSS animation pulsing border between faint and full amber (2s)
Canvas text: requestAnimationFrame pulse between #805800 and #ffb000 (2s)
```
Awaiting input. Both the bezel border and the canvas text pulse smoothly.

### Screen Bezel

The `.screen` wrapper provides the physical OLED module bezel appearance:

```css
border: 1px solid var(--oled-amber-faint);     /* Inner border */
outline: 2px solid rgba(64, 48, 0, 0.3);       /* Outer bezel */
outline-offset: 1px;                            /* Gap between */
box-shadow: inset 0 0 20px rgba(255, 176, 0, 0.03);  /* Subtle glow */
border-radius: 8px;
overflow: hidden;                               /* Clip canvas to bezel */
```

---

## Glyphs

Glyph tokens (`:name:`) appear in line1 and line3 text. Two rendering approaches:

### Character Glyphs (ASCII)

Rendered as plain text characters via the bitmap font, matching the ESP32 terminal.

| Token | Character | Meaning |
|-------|-----------|---------|
| `:pistol:` | `*` | Pistol item |
| `:phone:` | `$` | Phone item |
| `:crystal:` | `@` | Crystal ball item |
| `:village:` | `V` | Village team |
| `:lock:` | `!` | Selection locked |
| `:check:` | `+` | Check / confirmed |
| `:x:` | `-` | Rejected / failed |
| `:alpha:` | `A` | Alpha werewolf |
| `:pack:` | `P` | Pack indicator |

### Bitmap Glyphs (8x8 XBM)

Rendered directly as 8x8 pixel bitmaps on the canvas. Bitmap data from `esp32-terminal/src/protocol.h` XBM arrays, embedded in `TinyScreen.jsx`.

| Token | Bitmap | Source |
|-------|--------|--------|
| `:wolf:` | Wolf head (ears, snout) | `BITMAP_WOLF` |
| `:skull:` | Ghost (eyes, wavy base) | `BITMAP_GHOST` |

**Adding a new bitmap glyph:**
1. Define the 8-byte XBM array in `TinyScreen.jsx` `BITMAP_GLYPHS` (each byte = one row, bit 7 = leftmost pixel)
2. Add the `:token:` key to the `BITMAP_GLYPHS` map

---

## Button LED States

The server sends `display.leds.yes` and `display.leds.no` with every state update. These drive the visual appearance of the YES and NO buttons via CSS classes, mirroring the PWM-driven LEDs in the physical arcade buttons.

### State Table

| State | CSS Class | Background | Border | Label Color | Glow |
|-------|-----------|------------|--------|-------------|------|
| `off` | `led_yes_off` / `led_no_off` | Near-black | Dark tint | 15% opacity | None |
| `dim` | `led_yes_dim` / `led_no_dim` | Dark tint | 30% opacity | 50% opacity | Faint 6px |
| `bright` | `led_yes_bright` / `led_no_bright` | Saturated | Full color | Full color | 20px outer + 10px inset |
| `pulse` | `led_yes_pulse` / `led_no_pulse` | Animated | Animated | Animated | dim↔bright over 1s |

### When Each State Appears

| Game Context | YES LED | NO LED |
|--------------|---------|--------|
| Lobby / idle / dead / game over | off | off |
| Event active, no target selected, can abstain | off | dim |
| Event active, no target selected, cannot abstain | off | off |
| Event active, target selected, can abstain | bright | dim |
| Event active, target selected, cannot abstain | bright | off |
| Selection locked | off | off |
| Abstained | off | off |
| Ability mode (idle with items) | dim | off |

### Pulse Animation

```css
@keyframes yesLedPulse { /* 1s period, ease-in-out, matches ESP32 LED_PULSE_MS */ }
```
Cycles between dim and bright states. Currently `pulse` is defined in the `LedState` enum but not actively assigned by the server display builder. Available for future use (e.g., urgent prompts, timer warnings).

---

## Navigation Buttons (Rotary Encoder)

The physical terminal uses an EC11 rotary encoder with detents. The web simulates this with two round buttons (▲ ▼) styled to suggest a physical knob:

```css
background: radial-gradient(circle at 40% 35%, #222, #161616);  /* Off-center highlight */
box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.5);                /* Depth */
```

Active press shifts the gradient center and deepens the inset shadow. The visual gap between nav pair and action pair (`margin-right: var(--space-md)` on 2nd child) groups them as on the physical panel.

**Button enabled states:**
- Enabled during active events (scroll through targets)
- Enabled during ability mode (scroll through usable items)
- Disabled otherwise (lobby, idle, dead, locked, abstained)

---

## Indicator LEDs

### Power LED (D1)

```css
.powerLed {
  width: 8px; height: 8px;
  background-color: #e6a800;
  box-shadow: 0 0 6px rgba(230, 168, 0, 0.5), 0 0 12px rgba(230, 168, 0, 0.2);
}
```

Always on. Represents D1 on the PCB — a yellow 3mm LED wired directly to the 5V rail through R4 (220ohm). No state changes. If the page is loaded, power is "on."

### Neopixel (StatusLed)

RGB LED driven by the server's `statusLed` field. Colors and behavior:

| State | RGB | Color | Animation |
|-------|-----|-------|-----------|
| `lobby` | 100, 100, 100 | Gray | Static |
| `day` | 0, 255, 0 | Green | Static |
| `night` | 0, 0, 255 | Blue | Static |
| `voting` | 255, 200, 0 | Amber/yellow | Pulse (1s) |
| `locked` | 0, 255, 0 | Green | Static |
| `abstained` | 60, 60, 60 | Dark gray | Static |
| `dead` | 255, 0, 0 | Red | Static |
| `gameOver` | 100, 100, 100 | Gray | Static |

The neopixel is the only element on the player terminal that uses color beyond amber — it's a separate RGB LED, not part of the OLED.

### Player Label

```css
.playerLabel { flex: 1; text-align: center; font-size: 0.8rem; color: #bbb; }
```

Displays `#{seatNumber} {NAME}` (e.g., `#3 BEN`). Not a hardware component — added as QoL for the host viewing `/debug` or managing multiple player windows. Positioned in the indicator row to stay unobtrusive.

---

## Data Contract

### Display Object (server → client)

```javascript
{
  line1: { left: string, right: string },
  line2: { text: string, style: 'normal'|'locked'|'abstained'|'waiting' },
  line3: { text: string } | { left: string, right: string },
  leds: { yes: 'off'|'dim'|'bright'|'pulse', no: 'off'|'dim'|'bright'|'pulse' },
  statusLed: 'lobby'|'day'|'night'|'voting'|'locked'|'abstained'|'dead'|'gameOver'
}
```

Built by `Player.getDisplayState()` in `server/Player.js`. Sent via `ServerMsg.PLAYER_STATE` on every state change. Both web and ESP32 terminals consume the same object.

### Line1 Left Format

```
#{seatNumber} {ROLE|NAME} > {PHASE} {ROUND}[ > {EVENT}][ ({ITEM})][ :skull:]
```

Examples:
- `#3 PLAYER > LOBBY`
- `#3 WEREWOLF > NIGHT 1 > HUNT`
- `#3 VILLAGER > DAY 2 > VOTE`
- `#3 HUNTER > DAY 1 > SHOOT (PISTOL)`
- `#3 WEREWOLF > DAY 2 :skull:`

### Line3 Event Actions

The left/right labels in split mode come from a per-event-type action map:

| Event | Left (YES) | Right (NO) |
|-------|------------|------------|
| vote | VOTE | ABSTAIN |
| pardon | PARDON | CONDEMN |
| hunt / kill / vigil | KILL | ABSTAIN |
| investigate | REVEAL | ABSTAIN |
| protect | PROTECT | ABSTAIN |
| shoot | SHOOT | ABSTAIN |
| suspect | SUSPECT | ABSTAIN |
| customEvent | CONFIRM | ABSTAIN |

---

## File Map

```
client/src/
├── styles/
│   └── global.css                 ← --oled-* CSS variables
└── components/
    ├── TinyScreen.jsx             ← Canvas-based 256x64 OLED, bitmap font rendering
    ├── TinyScreen.module.css      ← Bezel styling, display style variants
    ├── oledFonts.js               ← Bitmap font data (6x10 + 10x20, from X.org misc-fixed)
    ├── PixelGlyph.jsx             ← 8x8 XBM bitmap → CSS box-shadow renderer (legacy)
    ├── PlayerConsole.jsx          ← Terminal layout, button wiring, LED states
    ├── PlayerConsole.module.css   ← Button LEDs, nav knobs, indicators, compact mode
    ├── StatusLed.jsx              ← Neopixel RGB indicator
    └── StatusLed.module.css       ← Neopixel sizing and pulse animation
```

---

## Design Principles

1. **Monochrome amber for the screen** — The OLED shows only shades of amber. States are conveyed through brightness and animation, never color.
2. **Color only for physical LEDs** — The neopixel (RGB), YES button (yellow), and NO button (red) are separate physical LEDs with their own colors. They live outside the OLED's amber world.
3. **Server-driven display** — The server builds the complete display object. The client renders it without interpreting game logic. What the server sends is what you see.
4. **Hardware parity** — Every visible element in the web UI maps to a physical component on the PCB. No web-only chrome (the player label is the sole exception, as host QoL).
5. **Three lines, always** — The screen always shows exactly three lines. Content adapts to fit, never expands or collapses the layout.
6. **Pixel-perfect rendering** — The canvas renders at the native 256x64 OLED resolution using the same bitmap fonts as the ESP32. CSS `image-rendering: pixelated` scales it up with a visible pixel grid, matching the physical display's appearance.
