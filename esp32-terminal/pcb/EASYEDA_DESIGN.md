# ESP32 Terminal PCB - EasyEDA Design Guide

## Overview

Breakout board for the Murderhouse ESP32 physical terminal. Connects an ESP32-S3-DevKitC-1 module to arcade buttons, rotary switch, OLED display, and Neopixel via Dupont headers.

## Bill of Materials (BOM)

### Headers (Dupont Breakouts)

| Ref | Component | Pins | LCSC Part | Notes |
|-----|-----------|------|-----------|-------|
| J1 | ESP32 Left | 1x20 Female | C2337 | 2.54mm pitch |
| J2 | ESP32 Right | 1x20 Female | C2337 | 2.54mm pitch |
| J3 | OLED Display | 1x7 Female | C2337 | VCC,GND,DIN,CLK,CS,DC,RST |
| J4 | YES Button | 1x4 Female | C2337 | COM,NO,LED+,LED- |
| J5 | NO Button | 1x4 Female | C2337 | COM,NO,LED+,LED- |
| J6 | Rotary Switch | 1x3 Female | C2337 | 3.3V,GND,SIG (active) |
| J7 | Rotary Positions | 1x8 Female | C2337 | Pos1-Pos8 connections |
| J8 | Neopixel | 1x3 Female | C2337 | 5V,GND,DIN |
| J9 | Power In | 1x2 or JST | C2337 | 5V,GND |

### Resistors (0805 SMD recommended)

| Ref | Value | Qty | LCSC Part | Purpose |
|-----|-------|-----|-----------|---------|
| R1 | 220Ω | 1 | C17557 | YES button LED |
| R2 | 220Ω | 1 | C17557 | NO button LED |
| R3 | 330Ω | 1 | C17630 | Neopixel data line |
| R4 | 510Ω | 1 | C17734 | Rotary ladder top |
| R5-R11 | 1kΩ | 7 | C17513 | Rotary ladder between positions |
| R12 | 510Ω | 1 | C17734 | Rotary ladder bottom |

*Note: 500Ω not standard - using 510Ω instead*

### Optional

| Ref | Component | LCSC Part | Purpose |
|-----|-----------|-----------|---------|
| C1 | 100µF 10V | C15008 | Neopixel power smoothing |
| D1 | Red LED 3mm | C84256 | Power indicator |
| R13 | 330Ω | C17630 | Power LED resistor |

---

## Schematic Connections

### ESP32-S3-DevKitC-1 Pinout Reference

The DevKit has pins on both sides. We'll use female headers to socket the module.

```
                    ESP32-S3-DevKitC-1
                    ┌─────────────────┐
              3V3  ─┤1              40├─ GND
              3V3  ─┤2              39├─ TX
              RST  ─┤3              38├─ RX
         GPIO 4   ─┤4  (YES_BTN)   37├─ GPIO 1  (ROTARY_ADC)
         GPIO 5   ─┤5  (YES_LED)   36├─ GPIO 2
         GPIO 6   ─┤6  (NO_BTN)    35├─ GPIO 42
         GPIO 7   ─┤7  (NO_LED)    34├─ GPIO 41
         GPIO 15  ─┤8              33├─ GPIO 40
         GPIO 16  ─┤9              32├─ GPIO 39
         GPIO 17  ─┤10             31├─ GPIO 38
         GPIO 18  ─┤11             30├─ GPIO 37
         GPIO 8   ─┤12 (NEOPIXEL)  29├─ GPIO 36
         GPIO 3   ─┤13             28├─ GPIO 35
         GPIO 46  ─┤14             27├─ GPIO 0
         GPIO 9   ─┤15 (OLED_DC)   26├─ GPIO 45
         GPIO 10  ─┤16 (OLED_CS)   25├─ GPIO 48
         GPIO 11  ─┤17 (OLED_MOSI) 24├─ GPIO 47
         GPIO 12  ─┤18 (OLED_CLK)  23├─ GPIO 21
         GPIO 13  ─┤19             22├─ GPIO 20
         GPIO 14  ─┤20 (OLED_RST)  21├─ GPIO 19
                    └─────────────────┘
                         USB-C
```

---

## Net List (Connection Table)

### OLED Display Header (J3)

| J3 Pin | Signal | Connects To |
|--------|--------|-------------|
| 1 | VCC | 3.3V rail |
| 2 | GND | GND rail |
| 3 | DIN | ESP32 GPIO 11 (pin 17) |
| 4 | CLK | ESP32 GPIO 12 (pin 18) |
| 5 | CS | ESP32 GPIO 10 (pin 16) |
| 6 | DC | ESP32 GPIO 9 (pin 15) |
| 7 | RST | ESP32 GPIO 14 (pin 20) |

### YES Button Header (J4)

| J4 Pin | Signal | Connects To |
|--------|--------|-------------|
| 1 | COM | GND rail |
| 2 | NO | ESP32 GPIO 4 (pin 4) |
| 3 | LED+ | R1 (220Ω) → ESP32 GPIO 5 (pin 5) |
| 4 | LED- | GND rail |

### NO Button Header (J5)

| J5 Pin | Signal | Connects To |
|--------|--------|-------------|
| 1 | COM | GND rail |
| 2 | NO | ESP32 GPIO 6 (pin 6) |
| 3 | LED+ | R2 (220Ω) → ESP32 GPIO 7 (pin 7) |
| 4 | LED- | GND rail |

### Rotary Switch Signal Header (J6)

| J6 Pin | Signal | Connects To |
|--------|--------|-------------|
| 1 | 3.3V | 3.3V rail (top of resistor ladder) |
| 2 | GND | GND rail (bottom of resistor ladder) |
| 3 | SIG | ESP32 GPIO 1 (pin 37) - Wiper/Common |

### Rotary Switch Positions Header (J7)

Connect your SP8T rotary switch positions to this header.
The resistor ladder is built into the PCB.

| J7 Pin | Signal | On-board Connection |
|--------|--------|---------------------|
| 1 | POS1 | After R4 (510Ω from 3.3V) |
| 2 | POS2 | After R5 (1kΩ from POS1) |
| 3 | POS3 | After R6 (1kΩ from POS2) |
| 4 | POS4 | After R7 (1kΩ from POS3) |
| 5 | POS5 | After R8 (1kΩ from POS4) |
| 6 | POS6 | After R9 (1kΩ from POS5) |
| 7 | POS7 | After R10 (1kΩ from POS6) |
| 8 | POS8 | After R11 (1kΩ from POS7), before R12 (510Ω to GND) |

**Resistor Ladder Schematic:**
```
3.3V ──R4(510Ω)──┬──POS1
                 │
              R5(1kΩ)
                 │
                 ├──POS2
                 │
              R6(1kΩ)
                 │
                 ├──POS3
                ...
                 │
              R11(1kΩ)
                 │
                 ├──POS8
                 │
              R12(510Ω)
                 │
                GND

Wiper (Common) connects to all POS points through the switch
and outputs to J6 Pin 3 (SIG) → GPIO 1
```

### Neopixel Header (J8)

| J8 Pin | Signal | Connects To |
|--------|--------|-------------|
| 1 | 5V | 5V rail |
| 2 | GND | GND rail |
| 3 | DIN | R3 (330Ω) → ESP32 GPIO 8 (pin 12) |

### Power Input (J9)

| J9 Pin | Signal | Notes |
|--------|--------|-------|
| 1 | 5V | Main power input |
| 2 | GND | Ground |

*Note: ESP32 DevKit has onboard regulator, so 5V in provides 3.3V rail*

---

## EasyEDA Step-by-Step

### 1. Create New Project
- Go to EasyEDA (easyeda.com)
- File → New → Project
- Name: "Murderhouse_ESP32_Terminal"

### 2. Create Schematic

#### Add Components:
1. Search library for "Female Header" or use generic connector symbols
2. Add resistors (search "0805 resistor" for SMD)
3. Draw the nets as shown above

#### Symbol Names:
- Use "HDR-1x20" for ESP32 headers
- Use "HDR-1x7", "HDR-1x4", etc. for breakouts
- Use "R_0805" for resistors

### 3. Assign Footprints
- Headers: 2.54mm pitch through-hole
- Resistors: 0805 SMD (or 0603 for smaller board)

### 4. Convert to PCB
- Design → Convert to PCB
- Set board size: ~60mm x 80mm recommended

### 5. PCB Layout Tips

```
Suggested Layout (Top View):
┌────────────────────────────────────────────┐
│  [J3 OLED]                    [J8 NEOPIX]  │
│   7-pin                         3-pin      │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │                                      │  │
│  │    [J1]  ESP32-S3-DevKit  [J2]      │  │
│  │   1x20                    1x20      │  │
│  │                                      │  │
│  └──────────────────────────────────────┘  │
│                                            │
│   [R4-R12 Resistor Ladder]                │
│                                            │
│  [J4 YES]    [J7 ROTARY]    [J5 NO]       │
│   4-pin       8-pin          4-pin        │
│                                            │
│              [J6 ROT SIG]                  │
│               3-pin                        │
│                                            │
│  [J9 PWR]    [R1] [R2] [R3]               │
│   2-pin       SMD resistors               │
└────────────────────────────────────────────┘
```

### 6. Design Rules (JLCPCB Compatible)
- Min trace width: 0.2mm (8mil)
- Min clearance: 0.2mm
- Min via: 0.3mm drill, 0.6mm pad
- Use 0.3mm traces for signals, 0.5mm for power

### 7. Generate Gerbers
- Fabrication → Gerber
- Select "JLCPCB" preset
- Download ZIP file

---

## Wiring Diagram (External Connections)

After assembling the PCB, connect:

```
OLED Display (SSD1322):
  Display Pin → J3 Pin
  VCC        → 1
  GND        → 2
  DIN/MOSI   → 3
  CLK/SCK    → 4
  CS         → 5
  DC         → 6
  RST        → 7

YES Button (4-pin arcade):
  Button Pin → J4 Pin
  COM        → 1
  NO         → 2
  LED+       → 3
  LED-       → 4

NO Button (4-pin arcade):
  Button Pin → J5 Pin
  COM        → 1
  NO         → 2
  LED+       → 3
  LED-       → 4

Rotary Switch (SP8T):
  Wiper/Common → J6 Pin 3
  Position 1   → J7 Pin 1
  Position 2   → J7 Pin 2
  ...
  Position 8   → J7 Pin 8

Neopixel (WS2811):
  Pixel Pin → J8 Pin
  VCC (5V)  → 1
  GND       → 2
  DIN       → 3

Power:
  5V USB/PSU → J9 Pin 1
  GND        → J9 Pin 2
```

---

## Testing Checklist

After assembly:
- [ ] Check for shorts between 3.3V, 5V, and GND
- [ ] Insert ESP32 module
- [ ] Power on - check 3.3V rail with multimeter
- [ ] Connect OLED - should show boot screen
- [ ] Test buttons - LEDs should light when GPIO driven
- [ ] Test rotary - ADC should read different values per position
- [ ] Test Neopixel - should show connection status color

---

## Files

After designing in EasyEDA, export:
- `Gerber_Murderhouse_Terminal.zip` - For JLCPCB fabrication
- `BOM_Murderhouse_Terminal.csv` - Bill of materials
- `PickAndPlace_Murderhouse_Terminal.csv` - For SMT assembly (optional)

## JLCPCB Order Settings

- Layers: 2
- Dimensions: (as designed)
- PCB Thickness: 1.6mm
- PCB Color: Black (recommended for aesthetics)
- Surface Finish: HASL or LeadFree HASL
- Copper Weight: 1oz
- Remove Order Number: Yes (cleaner look)

