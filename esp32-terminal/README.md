# Murderhouse ESP32 Physical Terminal

A physical game terminal that connects to the Murderhouse game server, providing a tactile arcade-style experience with OLED display, LED arcade buttons, and rotary switch input.

## Overview

This terminal replicates the React player console experience on dedicated hardware. Each player gets their own physical device with:

- **256x64 amber OLED display** showing game state
- **Green/Red LED arcade buttons** for YES/NO actions
- **8-position rotary switch** for target selection
- **RGB status LED** indicating connection state

The terminal connects via WiFi to the game server's WebSocket API and receives the same display state data as the React client.

**Multi-connection support**: A physical terminal and web client can control the same player simultaneously. Both receive state updates and either can send commands.

## Hardware Components

| Component       | Model                            | Purpose                         |
| --------------- | -------------------------------- | ------------------------------- |
| Microcontroller | ESP32-S3-DevKitC-1               | WiFi-enabled controller         |
| Display         | SSD1322 256x64 OLED (SPI, amber) | 3-line game display             |
| YES Button      | 4-pin arcade button (green LED)  | Confirm selection / Use ability |
| NO Button       | 4-pin arcade button (red LED)    | Abstain from vote               |
| Rotary Switch   | SP8T 8-way rotary selector       | Navigate targets (UP/DOWN)      |
| Power LED       | Through-hole red LED             | Power indicator                 |
| Status LED      | WS2811 Neopixel RGB              | Connection status               |

### Additional Components Needed

| Component       | Qty | Purpose                             |
| --------------- | --- | ----------------------------------- |
| 220Ω resistor   | 2   | Button LED current limiting         |
| 330Ω resistor   | 2   | Power LED + Neopixel data line      |
| 500Ω resistor   | 2   | Rotary ladder ends (top + bottom)   |
| 1kΩ resistor    | 7   | Rotary ladder between positions     |
| 100µF capacitor | 1   | Neopixel power smoothing (optional) |

## Wiring Diagram

### GPIO Pin Assignments (ESP32-S3)

```
SSD1322 OLED (SPI2):
  VCC  → 3.3V
  GND  → GND
  DIN  → GPIO 11 (SPI2 MOSI/SDA)
  CLK  → GPIO 12 (SPI2 SCK)
  CS   → GPIO 10 (SPI2 CS0)
  DC   → GPIO 9
  RST  → GPIO 14

YES Button (Green):
  COM  → GND
  NO   → GPIO 4 (internal pullup)
  LED+ → GPIO 5 (via 220Ω resistor)
  LED- → GND

NO Button (Red):
  COM  → GND
  NO   → GPIO 6 (internal pullup)
  LED+ → GPIO 7 (via 220Ω resistor)
  LED- → GND

Rotary Switch (Series Resistor Ladder):
  3.3V → 500Ω → Pos1 → 1kΩ → Pos2 → 1kΩ → ... → Pos8 → 500Ω → GND
  Common (wiper) → GPIO 1 (ADC1_CH0)

Power LED:
  Anode  → 3.3V (via 330Ω resistor)
  Cathode → GND

Neopixel (WS2811):
  VCC → 5V
  GND → GND
  DIN → GPIO 8 (via 330Ω resistor)
```

### Schematic

```
                              ┌─────────────────────────────────────┐
                              │       ESP32-S3-DevKitC-1            │
                              │                                     │
    SSD1322 OLED              │  3.3V ──────────────┬───────────────┼──→ VCC (OLED)
    ┌──────────┐              │                     │               │
    │          │←── DIN ──────┼── GPIO 11           │               │
    │          │←── CLK ──────┼── GPIO 12           ├── 330Ω ──┬──→ │ Power LED (+)
    │          │←── CS  ──────┼── GPIO 10           │          │    │
    │          │←── DC  ──────┼── GPIO 9            │         GND   │
    │          │←── RST ──────┼── GPIO 14           │               │
    │          │←── GND ──────┼── GND ──────────────┴───────────────┼──→ GND (OLED)
    │          │←── VCC ──────┼── 3.3V                              │
    └──────────┘              │                                     │
                              │                                     │
    YES Button (Green)        │                                     │
    ┌──────┐                  │                                     │
    │ COM  │───────────────── GND                                   │
    │ NO   │─────────────────┼── GPIO 4 (pullup)                    │
    │ LED+ │──── 220Ω ───────┼── GPIO 5                             │
    │ LED- │───────────────── GND                                   │
    └──────┘                  │                                     │
                              │                                     │
    NO Button (Red)           │                                     │
    ┌──────┐                  │                                     │
    │ COM  │───────────────── GND                                   │
    │ NO   │─────────────────┼── GPIO 6 (pullup)                    │
    │ LED+ │──── 220Ω ───────┼── GPIO 7                             │
    │ LED- │───────────────── GND                                   │
    └──────┘                  │                                     │
                              │                                     │
    Rotary Switch (SP8T) - Series Resistor Ladder                  │
                              │                                     │
    3.3V ── 500Ω ─┬─ Pos1     │                                     │
                  │    │      │                                     │
                 1kΩ   │      │                                     │
                  │    │      │                                     │
                 Pos2  │      │                                     │
                  │    │      │                                     │
                 1kΩ  Common ─┼── GPIO 1 (ADC)                      │
                  │  (wiper)  │                                     │
                 ...          │                                     │
                  │           │                                     │
                 Pos8         │                                     │
                  │           │                                     │
                 500Ω         │                                     │
                  │           │                                     │
                 GND          │                                     │
                              │                                     │
    Neopixel (WS2811)         │                                     │
    ┌──────┐                  │                                     │
    │ VCC  │───────────────── 5V                                    │
    │ GND  │───────────────── GND                                   │
    │ DIN  │──── 330Ω ───────┼── GPIO 8                             │
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

| State         | Line 1              | Line 2      | Line 3                   |
| ------------- | ------------------- | ----------- | ------------------------ |
| Lobby         | LOBBY               | WAITING     | Game will begin soon     |
| Selecting     | ROLE > EVENT        | TARGET NAME | YES confirm • NO abstain |
| Locked        | ROLE > EVENT :lock: | TARGET NAME | Selection locked         |
| Abstained     | ROLE > EVENT :x:    | ABSTAINED   | Waiting for others       |
| Dead          | ELIMINATED :skull:  | SPECTATOR   | Watch the game unfold    |
| Ability Ready | DAY N :pistol:      | USE PISTOL? | YES to use • 1/1         |

### Glyphs

Inline glyph tokens are rendered as characters:

| Token       | Display | Meaning            |
| ----------- | ------- | ------------------ |
| `:pistol:`  | `*`     | Pistol item        |
| `:phone:`   | `$`     | Phone item         |
| `:crystal:` | `@`     | Crystal Ball       |
| `:wolf:`    | `W`     | Werewolf indicator |
| `:lock:`    | `!`     | Selection locked   |
| `:x:`       | `-`     | Abstained          |
| `:alpha:`   | `A`     | Alpha werewolf     |
| `:pack:`    | `P`     | Pack suggestion    |
| `:skull:`   | `X`     | Dead/eliminated    |

## LED Behavior

### Button LEDs

| State  | Brightness | Behavior                   |
| ------ | ---------- | -------------------------- |
| OFF    | 0%         | No action available        |
| DIM    | 30%        | Secondary action available |
| BRIGHT | 100%       | Primary action ready       |
| PULSE  | 20-100%    | Waiting/loading (1s cycle) |

### Neopixel Status

| Connection State     | Color  | Pattern    |
| -------------------- | ------ | ---------- |
| Booting              | White  | Steady     |
| Player selection     | Purple | Pulse      |
| WiFi connecting      | Blue   | Slow pulse |
| WebSocket connecting | Yellow | Fast pulse |
| Joining game         | Cyan   | Steady     |
| Connected            | Green  | Steady     |
| Reconnecting         | Orange | Fast pulse |
| Error                | Red    | Steady     |

## Input Handling

### Player Selection (Boot)

On startup, the terminal displays a player selection screen:

1. Use the **rotary dial** to select player 1-9
2. Press **YES** to confirm and connect
3. The terminal joins as that player ID

This allows multiple physical terminals to connect as different players without reflashing.

### Rotary Switch (In-Game)

The 8-position rotary switch uses a series resistor ladder (500Ω-1kΩ-1kΩ-...-1kΩ-500Ω) connected to a single ADC pin. When the switch position changes:

- **Clockwise rotation** (position increases) → Sends `selectDown` (next target)
- **Counter-clockwise rotation** (position decreases) → Sends `selectUp` (previous target)

### Buttons

- **YES button** → Sends `confirm` (lock in selection or use ability)
- **NO button** → Sends `abstain` (skip voting)

### Reset Gesture

Hold **both YES and NO buttons** for 3 seconds to trigger a software restart:

1. After 3 seconds: Display shows "RESTARTING" with "Release to cancel"
2. After 2 more seconds (5 total): Terminal performs software reboot
3. Release buttons anytime to cancel

This is useful for changing player ID or recovering from stuck states without physical reset.

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
```

**Note**: Player ID (1-9) is selected at boot using the dial, not hardcoded in config.

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
{"type": "join", "payload": {"playerId": "1"}}
{"type": "selectUp", "payload": {}}
{"type": "selectDown", "payload": {}}
{"type": "confirm", "payload": {}}
{"type": "abstain", "payload": {}}
{"type": "useItem", "payload": {"itemId": "pistol"}}
```

**Note**: Player ID matches the number selected at boot (1-9), same format as web clients.

### Incoming Messages

The terminal primarily uses the `playerState` message which includes a `display` object:

```json
{
  "type": "playerState",
  "payload": {
    "display": {
      "line1": { "left": "ALPHA > KILL", "right": ":wolf:" },
      "line2": { "text": "PLAYER 3", "style": "normal" },
      "line3": { "text": "YES confirm • NO abstain" },
      "leds": { "yes": "bright", "no": "dim" }
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

- Verify resistor chain: 3.3V → 500Ω → Pos1 → 1kΩ → Pos2 → ... → Pos8 → 500Ω → GND
- Check ADC readings in serial monitor (should range ~260-3830)
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
- [x] Multiple terminal support with unique IDs (player selection at boot)
- [x] Multi-connection support (web + terminal simultaneously)
- [ ] OTA firmware updates
