# Murderhouse ESP32 Physical Terminal

A physical game terminal that connects to the Murderhouse game server, providing a tactile arcade-style experience with OLED display, LED arcade buttons, and rotary switch input.

## Overview

This terminal replicates the React player console experience on dedicated hardware. Each player gets their own physical device with:

- **256x64 amber OLED display** showing game state
- **Green/Red LED arcade buttons** for YES/NO actions
- **8-position rotary switch** for target selection
- **RGB status LED** indicating connection state

The terminal connects via WiFi to the game server's WebSocket API and receives the same display state data as the React client.

## Hardware Components

| Component | Model | Purpose |
|-----------|-------|---------|
| Microcontroller | YD-ESP32-23 (2022-V1.3) | WiFi-enabled controller |
| Display | SSD1322 256x64 OLED (SPI, amber) | 3-line game display |
| YES Button | 4-pin arcade button (green LED) | Confirm selection / Use ability |
| NO Button | 4-pin arcade button (red LED) | Abstain from vote |
| Rotary Switch | SP8T 8-way rotary selector | Navigate targets (UP/DOWN) |
| Power LED | Through-hole red LED | Power indicator |
| Status LED | WS2811 Neopixel RGB | Connection status |

### Additional Components Needed

| Component | Qty | Purpose |
|-----------|-----|---------|
| 220Ω resistor | 2 | Button LED current limiting |
| 330Ω resistor | 2 | Power LED + Neopixel data line |
| 1kΩ resistor | 1 | Rotary ladder position 1 |
| 2kΩ resistor | 1 | Rotary ladder position 2 |
| 3kΩ resistor | 1 | Rotary ladder position 3 |
| 4.7kΩ resistor | 1 | Rotary ladder position 4 |
| 6.8kΩ resistor | 1 | Rotary ladder position 5 |
| 10kΩ resistor | 2 | Rotary ladder position 6 + ADC pulldown |
| 15kΩ resistor | 1 | Rotary ladder position 7 |
| 22kΩ resistor | 1 | Rotary ladder position 8 |
| 100µF capacitor | 1 | Neopixel power smoothing (optional) |

## Wiring Diagram

### GPIO Pin Assignments

```
SSD1322 OLED (SPI):
  VCC  → 3.3V
  GND  → GND
  DIN  → GPIO 23 (VSPI MOSI)
  CLK  → GPIO 18 (VSPI SCK)
  CS   → GPIO 5  (VSPI CS0)
  DC   → GPIO 16
  RST  → GPIO 17

YES Button (Green):
  COM  → GND
  NO   → GPIO 32 (internal pullup)
  LED+ → GPIO 25 (via 220Ω resistor)
  LED- → GND

NO Button (Red):
  COM  → GND
  NO   → GPIO 33 (internal pullup)
  LED+ → GPIO 26 (via 220Ω resistor)
  LED- → GND

Rotary Switch (Resistor Ladder):
  Common → 3.3V
  Pos 1-8 → Through resistors to GPIO 34 (ADC)
  GPIO 34 → 10kΩ pulldown to GND

Power LED:
  Anode  → 3.3V (via 330Ω resistor)
  Cathode → GND

Neopixel (WS2811):
  VCC → 5V
  GND → GND
  DIN → GPIO 27 (via 330Ω resistor)
```

### Schematic

```
                              ┌─────────────────────────────────────┐
                              │         YD-ESP32-23                 │
                              │                                     │
    SSD1322 OLED              │  3.3V ──────────────┬───────────────┼──→ VCC (OLED)
    ┌──────────┐              │                     │               │
    │          │←── DIN ──────┼── GPIO 23           │               │
    │          │←── CLK ──────┼── GPIO 18           ├── 330Ω ──┬──→ │ Power LED (+)
    │          │←── CS  ──────┼── GPIO 5            │          │    │
    │          │←── DC  ──────┼── GPIO 16           │         GND   │
    │          │←── RST ──────┼── GPIO 17           │               │
    │          │←── GND ──────┼── GND ──────────────┴───────────────┼──→ GND (OLED)
    │          │←── VCC ──────┼── 3.3V                              │
    └──────────┘              │                                     │
                              │                                     │
    YES Button (Green)        │                                     │
    ┌──────┐                  │                                     │
    │ COM  │───────────────── GND                                   │
    │ NO   │─────────────────┼── GPIO 32 (pullup)                   │
    │ LED+ │──── 220Ω ───────┼── GPIO 25                            │
    │ LED- │───────────────── GND                                   │
    └──────┘                  │                                     │
                              │                                     │
    NO Button (Red)           │                                     │
    ┌──────┐                  │                                     │
    │ COM  │───────────────── GND                                   │
    │ NO   │─────────────────┼── GPIO 33 (pullup)                   │
    │ LED+ │──── 220Ω ───────┼── GPIO 26                            │
    │ LED- │───────────────── GND                                   │
    └──────┘                  │                                     │
                              │                                     │
    Rotary Switch (SP8T)      │                                     │
    ┌─────────┐               │                                     │
    │ Common  │────── 3.3V    │                                     │
    │ Pos 1   │── 1kΩ ──┐     │                                     │
    │ Pos 2   │── 2kΩ ──┤     │                                     │
    │ Pos 3   │── 3kΩ ──┤     │                                     │
    │ Pos 4   │── 4.7kΩ─┼─────┼── GPIO 34 (ADC)                     │
    │ Pos 5   │── 6.8kΩ─┤     │      │                              │
    │ Pos 6   │── 10kΩ ─┤     │      10kΩ (pulldown)                │
    │ Pos 7   │── 15kΩ ─┤     │      │                              │
    │ Pos 8   │── 22kΩ ─┘     │     GND                             │
    └─────────┘               │                                     │
                              │                                     │
    Neopixel (WS2811)         │                                     │
    ┌──────┐                  │                                     │
    │ VCC  │───────────────── 5V                                    │
    │ GND  │───────────────── GND                                   │
    │ DIN  │──── 330Ω ───────┼── GPIO 27                            │
    └──────┘                  │                                     │
                              └─────────────────────────────────────┘
```

## Display Format

The OLED displays a 3-line format matching the React TinyScreen component:

```
┌──────────────────────────────────────┐
│ ALPHA > KILL                    :wolf: │  ← Line 1: Context + glyphs (small)
│                                        │
│           PLAYER 3                     │  ← Line 2: Primary content (large)
│                                        │
│       YES confirm • NO abstain         │  ← Line 3: Tutorial tip (small)
└──────────────────────────────────────┘
```

### Display States

| State | Line 1 | Line 2 | Line 3 |
|-------|--------|--------|--------|
| Lobby | LOBBY | WAITING | Game will begin soon |
| Selecting | ROLE > EVENT | TARGET NAME | YES confirm • NO abstain |
| Locked | ROLE > EVENT :lock: | TARGET NAME | Selection locked |
| Abstained | ROLE > EVENT :x: | ABSTAINED | Waiting for others |
| Dead | ELIMINATED :skull: | SPECTATOR | Watch the game unfold |
| Ability Ready | DAY N :pistol: | USE PISTOL? | YES to use • 1/1 |

### Glyphs

Inline glyph tokens are rendered as characters:

| Token | Display | Meaning |
|-------|---------|---------|
| `:pistol:` | `*` | Pistol item |
| `:phone:` | `$` | Phone item |
| `:crystal:` | `@` | Crystal Ball |
| `:wolf:` | `W` | Werewolf indicator |
| `:lock:` | `!` | Selection locked |
| `:x:` | `-` | Abstained |
| `:alpha:` | `A` | Alpha werewolf |
| `:pack:` | `P` | Pack suggestion |
| `:skull:` | `X` | Dead/eliminated |

## LED Behavior

### Button LEDs

| State | Brightness | Behavior |
|-------|------------|----------|
| OFF | 0% | No action available |
| DIM | 30% | Secondary action available |
| BRIGHT | 100% | Primary action ready |
| PULSE | 20-100% | Waiting/loading (1s cycle) |

### Neopixel Status

| Connection State | Color | Pattern |
|------------------|-------|---------|
| Booting | White | Steady |
| WiFi connecting | Blue | Slow pulse |
| WebSocket connecting | Yellow | Fast pulse |
| Joining game | Cyan | Steady |
| Connected | Green | Steady |
| Reconnecting | Orange | Fast pulse |

## Input Handling

### Rotary Switch

The 8-position rotary switch uses a resistor ladder connected to a single ADC pin. When the switch position changes:

- **Clockwise rotation** (position increases) → Sends `selectDown` (next target)
- **Counter-clockwise rotation** (position decreases) → Sends `selectUp` (previous target)

### Buttons

- **YES button** → Sends `confirm` (lock in selection or use ability)
- **NO button** → Sends `abstain` (skip voting)

## Setup & Configuration

### 1. Install PlatformIO

Install [PlatformIO IDE](https://platformio.org/install/ide) or CLI.

### 2. Configure Network

Edit `src/config.h`:

```cpp
// WiFi credentials
#define WIFI_SSID "YourWiFiNetwork"
#define WIFI_PASSWORD "YourWiFiPassword"

// Game server
#define WS_HOST "192.168.1.100"  // Server IP address
#define WS_PORT 8080

// Unique ID for this terminal
#define PLAYER_ID "esp32-terminal-001"
```

### 3. Build & Flash

```bash
# Build the project
pio run

# Upload to ESP32
pio run --target upload

# Monitor serial output
pio device monitor
```

## Project Structure

```
esp32-terminal/
├── platformio.ini      # PlatformIO configuration
├── README.md           # This file
└── src/
    ├── config.h        # Network & pin configuration
    ├── protocol.h      # Message types & data structures
    ├── display.h/cpp   # SSD1322 OLED driver
    ├── input.h/cpp     # Button & rotary input handling
    ├── leds.h/cpp      # Button LEDs & Neopixel control
    ├── network.h/cpp   # WiFi & WebSocket client
    └── main.cpp        # Main application loop
```

## Dependencies

Managed automatically by PlatformIO:

- **U8g2** - Display driver for SSD1322
- **WebSockets** - WebSocket client
- **ArduinoJson** - JSON parsing
- **Adafruit NeoPixel** - RGB LED control

## WebSocket Protocol

The terminal implements the same protocol as the React client:

### Outgoing Messages

```json
{"type": "join", "payload": {"playerId": "esp32-terminal-001"}}
{"type": "selectUp", "payload": {}}
{"type": "selectDown", "payload": {}}
{"type": "confirm", "payload": {}}
{"type": "abstain", "payload": {}}
{"type": "useItem", "payload": {"itemId": "pistol"}}
```

### Incoming Messages

The terminal primarily uses the `playerState` message which includes a `display` object:

```json
{
  "type": "playerState",
  "payload": {
    "display": {
      "line1": {"left": "ALPHA > KILL", "right": ":wolf:"},
      "line2": {"text": "PLAYER 3", "style": "normal"},
      "line3": {"text": "YES confirm • NO abstain"},
      "leds": {"yes": "bright", "no": "dim"}
    }
  }
}
```

## Troubleshooting

### Display not working
- Check SPI connections (MOSI, CLK, CS, DC, RST)
- Verify 3.3V power to display
- Try adjusting contrast in `display.cpp`

### Buttons not responding
- Verify buttons are wired to GND (COM) and GPIO (NO)
- Check that internal pullups are enabled
- Monitor serial output for input events

### Rotary switch not detecting positions
- Verify resistor values in the ladder
- Check ADC readings in serial monitor
- Adjust thresholds in `config.h` if needed

### WiFi not connecting
- Verify SSID and password in `config.h`
- Check that ESP32 is within WiFi range
- Monitor serial output for connection status

### WebSocket not connecting
- Verify server IP and port
- Ensure game server is running
- Check firewall settings

## Future Improvements

- [ ] Custom bitmap glyphs instead of ASCII characters
- [ ] Sound effects via buzzer
- [ ] Battery power option
- [ ] 3D printed enclosure design
- [ ] Multiple terminal support with unique IDs
- [ ] OTA firmware updates
