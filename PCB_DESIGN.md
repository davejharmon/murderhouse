# ESP32 Terminal PCB - EasyEDA Design Guide

## Overview

Breakout board for the Murderhouse ESP32 physical terminal. Connects an ESP32-S3-DevKitC-1 module to arcade buttons, rotary encoder, OLED display, and Neopixel via Dupont headers.

## Bill of Materials (BOM)

### Headers (ESP32 Socket)

| Ref | Component      | Pins        | LCSC Part | Notes                     |
| --- | -------------- | ----------- | --------- | ------------------------- |
| J1  | ESP32 Left     | 1x22 Female | C2337     | 2.54mm pitch              |
| J2  | ESP32 Right    | 1x22 Female | C2337     | 2.54mm pitch              |

### Connectors (JST-XH, Panel Components)

| Ref | Component      | Connector        | LCSC Part | Notes                     |
| --- | -------------- | ---------------- | --------- | ------------------------- |
| J3  | OLED Display   | XH 7-pin (B7B)  | C144398   | CS,DC,RES,SDA,SCK,VCC,GND |
| J4  | YES Button     | XH 4-pin (B4B)  | C144395   | COM,NO,LED+,LED-          |
| J5  | NO Button      | XH 4-pin (B4B)  | C144395   | COM,NO,LED+,LED-          |
| J6  | Rotary Encoder | XH 5-pin (B5B)  | C157991   | GND,A,B,SW,GND            |
| J7  | Neopixel       | XH 3-pin (B3B)  | C144394   | 5V,GND,DIN                |
| J10 | Power LED (D1) | XH 2-pin (B2B)  | C158012   | LED+,LED-                 |
| J11 | I2C LED (D2)*  | XH 2-pin (B2B)  | C158012   | LED+,LED-                 |
| J12 | Heartbeat (D3)*| XH 2-pin (B2B)  | C158012   | LED+,LED-                 |

_JST-XH connectors are keyed/polarized (2.5mm pitch). Crimp XH terminals onto panel wires._

_Note: Power supplied via ESP32 DevKit USB-C port - no separate power header needed_

### Resistors (0805 SMD recommended)

| Ref | Value | Qty | LCSC Part | Purpose                    | Current        |
| --- | ----- | --- | --------- | -------------------------- | -------------- |
| R1  | 100Ω  | 1   | C17408    | YES button LED (yellow)    | ~13mA @ 3.3V   |
| R2  | 150Ω  | 1   | C17471    | NO button LED (red)        | ~10mA @ 3.3V   |
| R3  | 330Ω  | 1   | C17630    | Neopixel data line         | —              |
| R4  | 220Ω  | 1   | C17557    | Power LED D1 (yellow)      | ~14mA @ 5V     |
| R7  | 150Ω  | 1   | C17471    | I2C status LED D2 (red)*   | ~10mA @ 3.3V   |
| R8  | 100Ω  | 1   | C17408    | Heartbeat LED D3 (green)*  | ~13mA @ 3.3V   |

_*R7 and R8 are optional - only populate with corresponding LEDs_

_Resistor values chosen to equalise perceived brightness across colours. Red LEDs are_
_more efficient so run at lower current (~10mA). Yellow and green LEDs run at ~13–14mA._

### Capacitors

| Ref | Value     | LCSC Part | Purpose                  |
| --- | --------- | --------- | ------------------------ |
| C1  | 100µF 10V | C15008    | Neopixel power smoothing |

### LEDs (Panel-Mounted with Bezels)

| Ref | Component       | LCSC Part | Purpose              | Connector |
| --- | --------------- | --------- | -------------------- | --------- |
| D1  | Yellow LED 3mm  | C85160    | Power indicator      | J10       |
| D2  | Red LED 3mm     | C84256    | I2C device detected* | J11       |
| D3  | Green LED 3mm   | C85161    | Heartbeat pulse*     | J12       |

_All indicator LEDs are panel-mounted in 3mm bezels, wired back to PCB via JST-XH 2-pin._
_Button LEDs: YES = yellow, NO = red (built into arcade buttons)._
_*D2 and D3 are optional - only populate if using I2C TRRS or AD8232 expansions._

### Rotary Encoder

| Ref | Component          | LCSC Part | Purpose              |
| --- | ------------------ | --------- | -------------------- |
| SW1 | EC11 Rotary Encoder| C318884   | Navigation dial      |

_EC11 is a standard 5-pin encoder with detents. Only 3 pins used (GND, A, B). Push-button pin optional._

### Optional: Heart Rate Monitor (AD8232)

| Ref | Component          | Pins | LCSC Part | Notes                      |
| --- | ------------------ | ---- | --------- | -------------------------- |
| J8  | AD8232 Breakout    | XH 6-pin (B6B) | C144397 | GND,3V3,OUT,LO+,LO-,SDN |

_AD8232 is a single-lead heart rate monitor. Connect electrode pads to RA/LA/RL pads on breakout._

### Optional: I2C Expansion

| Ref | Component          | LCSC Part | Notes                       |
| --- | ------------------ | --------- | --------------------------- |
| J9  | I2C Expansion      | C144395   | XH 4-pin (B4B): SDA,SCL,3V3,GND |
| R5  | 4.7kΩ              | C17673    | I2C SDA pullup (optional)   |
| R6  | 4.7kΩ              | C17673    | I2C SCL pullup (optional)   |

_Panel-mount a 3.5mm TRRS jack or another JST-XH socket and wire back to J9._
_TRRS pinout: Tip=SDA, Ring1=SCL, Ring2=3.3V, Sleeve=GND._

---

## Schematic Connections

### ESP32-S3-DevKitC-1 Pinout Reference

The DevKit has pins on both sides. We'll use female headers to socket the module.
Power is supplied via the DevKit's USB-C port. The 5V pin provides USB voltage to the 5V rail.

```
                    ESP32-S3-DevKitC-1
                    ┌─────────────────┐
              3V3  ─┤1              44├─ GND
              3V3  ─┤2              43├─ TX
              RST  ─┤3              42├─ RX
         GPIO 4   ─┤4  (YES_BTN)   41├─ GPIO 1  (ENCODER_A)
         GPIO 5   ─┤5  (YES_LED)   40├─ GPIO 2  (ENCODER_B)
         GPIO 6   ─┤6  (NO_BTN)    39├─ GPIO 42 (ENCODER_SW)
         GPIO 7   ─┤7  (NO_LED)    38├─ GPIO 41
         GPIO 15  ─┤8  (I2C_SDA)*  37├─ GPIO 40
         GPIO 16  ─┤9  (I2C_SCL)*  36├─ GPIO 39
         GPIO 17  ─┤10 (AD_LO+)*   35├─ GPIO 38
         GPIO 18  ─┤11 (AD_LO-)*   34├─ GPIO 37
         GPIO 8   ─┤12 (NEOPIXEL)  33├─ GPIO 36
         GPIO 3   ─┤13 (AD_OUT)*   32├─ GPIO 35
         GPIO 46  ─┤14             31├─ GPIO 0
         GPIO 9   ─┤15 (OLED_DC)   30├─ GPIO 45
         GPIO 10  ─┤16 (OLED_CS)   29├─ GPIO 48
         GPIO 11  ─┤17 (OLED_SDA)  28├─ GPIO 47
         GPIO 12  ─┤18 (OLED_SCK)  27├─ GPIO 21
         GPIO 13  ─┤19 (AD_SDN)*   26├─ GPIO 20 (HB_LED)*
         GPIO 14  ─┤20 (OLED_RST)  25├─ GPIO 19 (I2C_LED)*
               5V  ─┤21             24├─ GND
              GND  ─┤22             23├─ GND
                    └─────────────────┘
                         USB-C

        * = Optional expansion (AD8232 heart monitor, I2C TRRS)
```

---

## Net List (Connection Table)

### OLED Display Header (J3)

| J3 Pin | Signal | Connects To            |
| ------ | ------ | ---------------------- |
| 1      | CS     | ESP32 GPIO 10 (pin 16) |
| 2      | DC     | ESP32 GPIO 9 (pin 15)  |
| 3      | RES    | ESP32 GPIO 14 (pin 20) |
| 4      | SDA    | ESP32 GPIO 11 (pin 17) |
| 5      | SCK    | ESP32 GPIO 12 (pin 18) |
| 6      | VCC    | 3.3V rail              |
| 7      | GND    | GND rail               |

### YES Button Header (J4)

| J4 Pin | Signal | Connects To                      |
| ------ | ------ | -------------------------------- |
| 1      | COM    | GND rail                         |
| 2      | NO     | ESP32 GPIO 4 (pin 4)             |
| 3      | LED+   | R1 (220Ω) → ESP32 GPIO 5 (pin 5) |
| 4      | LED-   | GND rail                         |

### NO Button Header (J5)

| J5 Pin | Signal | Connects To                      |
| ------ | ------ | -------------------------------- |
| 1      | COM    | GND rail                         |
| 2      | NO     | ESP32 GPIO 6 (pin 6)             |
| 3      | LED+   | R2 (220Ω) → ESP32 GPIO 7 (pin 7) |
| 4      | LED-   | GND rail                         |

### Rotary Encoder Header (J6)

| J6 Pin | Signal | Connects To              |
| ------ | ------ | ------------------------ |
| 1      | GND    | GND rail (encoder common)|
| 2      | A      | ESP32 GPIO 1 (pin 37)    |
| 3      | B      | ESP32 GPIO 2 (pin 36)    |
| 4      | SW     | ESP32 GPIO 42 (pin 35)   |
| 5      | GND    | GND rail (switch common) |

_EC11 encoder with push button. Uses internal pullups on ESP32. Button active LOW._

### Neopixel Header (J7)

| J7 Pin | Signal | Connects To                       |
| ------ | ------ | --------------------------------- |
| 1      | 5V     | 5V rail                           |
| 2      | GND    | GND rail                          |
| 3      | DIN    | R3 (330Ω) → ESP32 GPIO 8 (pin 12) |

_C1 (100µF) placed across 5V and GND near J7 for power smoothing_

### Power (via ESP32 USB-C)

Power is supplied through the ESP32 DevKit's USB-C port. No separate power connector needed.

| Source         | Connects To | Notes                                |
| -------------- | ----------- | ------------------------------------ |
| ESP32 5V pin (pin 21) | 5V rail | Provides USB voltage for Neopixel |
| ESP32 3V3 pins | 3.3V rail   | Regulated by DevKit for OLED         |
| ESP32 GND      | GND rail    | Common ground                        |

### Power LED Header (J10 → D1)

| J10 Pin | Signal | Connects To           |
| ------- | ------ | --------------------- |
| 1       | LED+   | 5V rail via R4 (220Ω) |
| 2       | LED-   | GND rail              |

_Yellow LED in 3mm panel bezel. Indicates USB power is connected._

### Optional: AD8232 Heart Monitor Header (J8)

| J8 Pin | Signal | Connects To              |
| ------ | ------ | ------------------------ |
| 1      | GND    | GND rail                 |
| 2      | 3.3V   | 3.3V rail                |
| 3      | OUTPUT | ESP32 GPIO 3 (pin 13)    |
| 4      | LO+    | ESP32 GPIO 17 (pin 10)   |
| 5      | LO-    | ESP32 GPIO 18 (pin 11)   |
| 6      | SDN    | ESP32 GPIO 13 (pin 19)   |

_AD8232 OUTPUT is analog (0-3.3V). GPIO 3 is ADC1_CH2. LO+/LO- go HIGH when electrodes detach._

### Optional: I2C Expansion Header (J9)

| J9 Pin | Signal | Connects To                         |
| ------ | ------ | ----------------------------------- |
| 1      | SDA    | ESP32 GPIO 15 (pin 8) via R5 4.7kΩ  |
| 2      | SCL    | ESP32 GPIO 16 (pin 9) via R6 4.7kΩ  |
| 3      | 3.3V   | 3.3V rail                           |
| 4      | GND    | GND rail                            |

_Pullups R5/R6 optional if target device has internal pullups._
_Wire to a panel-mounted TRRS jack (Tip=SDA, Ring1=SCL, Ring2=3.3V, Sleeve=GND)_
_or another JST-XH socket for direct I2C sensor connection._

### Optional: I2C Status LED Header (J11 → D2)

| J11 Pin | Signal | Connects To                        |
| ------- | ------ | ---------------------------------- |
| 1       | LED+   | R7 (150Ω) → ESP32 GPIO 19 (pin 25) |
| 2       | LED-   | GND rail                           |

_Red LED in 3mm panel bezel. Illuminates when I2C device detected on TRRS port. Active HIGH._

### Optional: Heartbeat LED Header (J12 → D3)

| J12 Pin | Signal | Connects To                        |
| ------- | ------ | ---------------------------------- |
| 1       | LED+   | R8 (100Ω) → ESP32 GPIO 20 (pin 26) |
| 2       | LED-   | GND rail                           |

_Green LED in 3mm panel bezel. Pulses with detected heartbeat from AD8232. Driven by peak detection in firmware._

### Power Budget

| Component              | Current (typical) |
| ---------------------- | ----------------- |
| ESP32-S3 (WiFi active) | 200-300mA         |
| 2× LED arcade buttons  | 40-100mA          |
| 1× WS2811 Neopixel     | 60mA max          |
| 1× Power LED           | 15mA              |
| OLED SSD1322           | 100-150mA         |
| **Base Total**         | **~500mA**        |
| ---------------------- | ----------------- |
| _Optional:_            |                   |
| AD8232 Heart Monitor   | ~1mA              |
| Heartbeat LED (D3)     | ~10mA             |
| I2C Sensor (typical)   | 1-10mA            |
| I2C Status LED (D2)    | ~10mA             |
| **Max Total**          | **~540mA**        |

_Use a USB-C power adapter rated 5V 2A for headroom (any phone charger works)_

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

- Use "HDR-1x22" for ESP32 socket headers (J1/J2)
- Use "XH-7A", "XH-5A", "XH-4A", "XH-3A" for JST-XH panel connectors (J3–J7)
- Use "R_0805" for resistors

### 3. Assign Footprints

- ESP32 headers (J1/J2): 2.54mm pitch female through-hole
- Panel connectors (J3–J7): JST-XH 2.5mm pitch through-hole
- Resistors: 0805 SMD (or 0603 for smaller board)

### 4. Convert to PCB

- Design → Convert to PCB
- Set board size: ~70mm x 85mm recommended (or 60x80mm if omitting optional headers)

### 5. PCB Layout Tips

```
Suggested Layout (Top View):
┌────────────────────────────────────────────────────┐
│  [J3 OLED]                          [J7 NEOPIX]    │
│   7-pin                               3-pin        │
│                                                    │
│  ┌──────────────────────────────────────┐  [D2]    │
│  │                                      │  I2C     │
│  │    [J1]  ESP32-S3-DevKit  [J2]      │  [J9]    │
│  │   1x22                    1x22      │  I2C     │
│  │                                      │  (opt)   │
│  └──────────────────────────────────────┘          │
│                                                    │
│                  [C1]                   [D3] [J8]  │
│                                         HB  AD8232│
│  [J4 YES]    [J6 ENCODER]    [J5 NO]       6-pin  │
│   4-pin        5-pin          4-pin        (opt)  │
│                                                    │
│  [J10 PWR] [R1-R4]  [R5-R6 opt]  [R7-R8 opt]      │
│  [J11 I2C] [J12 HB]  SMD resistors               │
│   (opt)     (opt)                                 │
└────────────────────────────────────────────────────┘

Panel LED connector notes:
- J10 (D1 yellow power): Always populated
- J11 (D2 red I2C):      Optional, near J9 I2C header
- J12 (D3 green heartbeat): Optional, near J8 AD8232 header
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
  CS         → 1
  DC         → 2
  RES        → 3
  SDA        → 4
  SCK        → 5
  VCC        → 6
  GND        → 7

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

Rotary Encoder (EC11 with button):
  Encoder Pin → J6 Pin
  GND         → 1
  A (CLK)     → 2
  B (DT)      → 3
  SW          → 4
  SW GND      → 5

Neopixel (WS2811):
  Pixel Pin → J7 Pin
  VCC (5V)  → 1
  GND       → 2
  DIN       → 3

Panel LEDs (3mm in bezels):
  LED Pin  → Connector
  D1 (yellow power):     Anode → J10 pin 1, Cathode → J10 pin 2
  D2 (red I2C)*:         Anode → J11 pin 1, Cathode → J11 pin 2
  D3 (green heartbeat)*: Anode → J12 pin 1, Cathode → J12 pin 2

Power:
  Connect USB-C power brick to ESP32 DevKit USB-C port
  (No external power wiring needed - 5V rail fed from ESP32 5V pin)

Optional - AD8232 Heart Monitor:
  Breakout Pin → J8 Pin
  GND          → 1
  3.3V         → 2
  OUTPUT       → 3
  LO+          → 4
  LO-          → 5
  SDN          → 6

  Electrode pads connect to AD8232 breakout:
  - RA (Right Arm) - typically right wrist or chest
  - LA (Left Arm)  - typically left wrist or chest
  - RL (Right Leg) - reference, typically lower body

Optional - I2C Expansion (J9):
  J9 Pin → Signal
  1      → SDA (data)
  2      → SCL (clock)
  3      → 3.3V (power)
  4      → GND

  Wire to panel-mounted TRRS jack or JST-XH socket.
  TRRS mapping: Tip=SDA, Ring1=SCL, Ring2=3.3V, Sleeve=GND.
  Compatible I2C sensors can be wired to TRRS plugs for
  quick connect/disconnect (e.g., pulse oximeter, temp sensor)
```

---

## Testing Checklist

After assembly:

- [ ] Check for shorts between 3.3V, 5V, and GND
- [ ] Insert ESP32 module
- [ ] Connect USB-C power - D1 (yellow power LED) should illuminate
- [ ] Check 3.3V and 5V rails with multimeter
- [ ] Connect OLED - should show boot screen
- [ ] Test buttons - LEDs should light when GPIO driven
- [ ] Test encoder - rotating should move selection up/down
- [ ] Test Neopixel - should show connection status color

Optional expansions (if populated):

- [ ] AD8232: Attach electrodes, verify analog signal on GPIO 3
- [ ] AD8232: LO+/LO- go HIGH when leads disconnected
- [ ] AD8232: D3 (green heartbeat LED) pulses with detected beats
- [ ] I2C (J9): Scan for devices with I2C scanner sketch
- [ ] I2C (J9): Verify 3.3V on pin 3, GND on pin 4
- [ ] I2C (J9): D2 (red LED) lights when device detected

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
