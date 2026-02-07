# ESP32 Terminal PCB - EasyEDA Design Guide

## Overview

Breakout board for the Murderhouse ESP32 physical terminal. Connects an ESP32-S3-DevKitC-1 module to arcade buttons, rotary encoder, OLED display, and Neopixel via Dupont headers.

## Bill of Materials (BOM)

### Headers (Dupont Breakouts)

| Ref | Component      | Pins        | LCSC Part | Notes                     |
| --- | -------------- | ----------- | --------- | ------------------------- |
| J1  | ESP32 Left     | 1x22 Female | C2337     | 2.54mm pitch              |
| J2  | ESP32 Right    | 1x22 Female | C2337     | 2.54mm pitch              |
| J3  | OLED Display   | 1x7 Female  | C2337     | CS,DC,RES,SDA,SCK,VCC,GND |
| J4  | YES Button     | 1x4 Female  | C2337     | COM,NO,LED+,LED-          |
| J5  | NO Button      | 1x4 Female  | C2337     | COM,NO,LED+,LED-          |
| J6  | Rotary Encoder | 1x5 Female  | C2337     | GND,A,B,SW,GND            |
| J7  | Neopixel       | 1x3 Female  | C2337     | 5V,GND,DIN                |

_Note: Power supplied via ESP32 DevKit USB-C port - no separate power header needed_

### Resistors (0805 SMD recommended)

| Ref | Value | Qty | LCSC Part | Purpose              |
| --- | ----- | --- | --------- | -------------------- |
| R1  | 220Ω  | 1   | C17557    | YES button LED       |
| R2  | 220Ω  | 1   | C17557    | NO button LED        |
| R3  | 330Ω  | 1   | C17630    | Neopixel data line   |
| R4  | 330Ω  | 1   | C17630    | Power LED resistor   |
| R7  | 330Ω  | 1   | C17630    | I2C status LED (D2)* |
| R8  | 330Ω  | 1   | C17630    | Heartbeat LED (D3)*  |

_*R7 and R8 are optional - only populate with corresponding LEDs_

### Capacitors

| Ref | Value     | LCSC Part | Purpose                  |
| --- | --------- | --------- | ------------------------ |
| C1  | 100µF 10V | C15008    | Neopixel power smoothing |

### LEDs

| Ref | Component     | LCSC Part | Purpose              |
| --- | ------------- | --------- | -------------------- |
| D1  | Red LED 3mm   | C84256    | Power indicator      |
| D2  | Blue LED 3mm  | C84258    | I2C device detected* |
| D3  | Red LED 3mm   | C84256    | Heartbeat pulse*     |

_*D2 and D3 are optional - only populate if using I2C TRRS or AD8232 expansions_

### Rotary Encoder

| Ref | Component          | LCSC Part | Purpose              |
| --- | ------------------ | --------- | -------------------- |
| SW1 | EC11 Rotary Encoder| C318884   | Navigation dial      |

_EC11 is a standard 5-pin encoder with detents. Only 3 pins used (GND, A, B). Push-button pin optional._

### Optional: Heart Rate Monitor (AD8232)

| Ref | Component          | Pins | LCSC Part | Notes                      |
| --- | ------------------ | ---- | --------- | -------------------------- |
| J8  | AD8232 Breakout    | 1x6  | C2337     | GND,3V3,OUT,LO+,LO-,SDN    |

_AD8232 is a single-lead heart rate monitor. Connect electrode pads to RA/LA/RL pads on breakout._

### Optional: I2C Expansion (TRRS)

| Ref | Component          | LCSC Part | Notes                       |
| --- | ------------------ | --------- | --------------------------- |
| J9  | 3.5mm TRRS Jack    | C145819   | PJ-320A or equivalent       |
| R5  | 4.7kΩ              | C17673    | I2C SDA pullup (optional)   |
| R6  | 4.7kΩ              | C17673    | I2C SCL pullup (optional)   |

_TRRS pinout: Tip=SDA, Ring1=SCL, Ring2=3.3V, Sleeve=GND. Directly compatible with I2C sensors._

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
         GPIO 11  ─┤17 (OLED_MOSI) 28├─ GPIO 47
         GPIO 12  ─┤18 (OLED_CLK)  27├─ GPIO 21
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

### Power LED (D1)

| Component  | Connects To            |
| ---------- | ---------------------- |
| D1 Anode   | 5V rail via R4 (330Ω)  |
| D1 Cathode | GND rail               |

_Power LED indicates USB power is connected_

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

### Optional: I2C TRRS Jack (J9)

| J9 Pin  | Signal | Connects To                        |
| ------- | ------ | ---------------------------------- |
| Tip     | SDA    | ESP32 GPIO 15 (pin 8) via R5 4.7kΩ |
| Ring 1  | SCL    | ESP32 GPIO 16 (pin 9) via R6 4.7kΩ |
| Ring 2  | 3.3V   | 3.3V rail                          |
| Sleeve  | GND    | GND rail                           |

_Standard I2C over TRRS. Pullups R5/R6 optional if target device has internal pullups._
_Compatible with I2C sensor breakouts wired to 3.5mm TRRS plugs._

### Optional: I2C Status LED (D2)

| Component  | Connects To                       |
| ---------- | --------------------------------- |
| D2 Anode   | R7 (330Ω) → ESP32 GPIO 19 (pin 21)|
| D2 Cathode | GND rail                          |

_Blue LED illuminates when I2C device detected on TRRS port. Active HIGH._

### Optional: Heartbeat LED (D3)

| Component  | Connects To                       |
| ---------- | --------------------------------- |
| D3 Anode   | R8 (330Ω) → ESP32 GPIO 20 (pin 22)|
| D3 Cathode | GND rail                          |

_Red LED pulses with detected heartbeat from AD8232. Driven by peak detection in firmware._

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

- Use "HDR-1x22" for ESP32 headers
- Use "HDR-1x7", "HDR-1x4", etc. for breakouts
- Use "R_0805" for resistors

### 3. Assign Footprints

- Headers: 2.54mm pitch through-hole
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
│  │   1x22                    1x22      │  TRRS    │
│  │                                      │  (opt)   │
│  └──────────────────────────────────────┘          │
│                                                    │
│                  [C1]                   [D3] [J8]  │
│                                         HB  AD8232│
│  [J4 YES]    [J6 ENCODER]    [J5 NO]       6-pin  │
│   4-pin        5-pin          4-pin        (opt)  │
│                                                    │
│  [D1 PWR]  [R1-R4]  [R5-R6 opt]  [R7-R8 opt]      │
│             SMD resistors                         │
└────────────────────────────────────────────────────┘

LED placement notes:
- D2 (blue): Near TRRS jack, indicates I2C device connected
- D3 (red):  Near AD8232 header, pulses with heartbeat
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
  SDA/MOSI   → 4
  SCK/CLK    → 5
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

Optional - I2C TRRS (J9):
  Standard 3.5mm TRRS cable wiring:
  Tip    → SDA (data)
  Ring1  → SCL (clock)
  Ring2  → 3.3V (power)
  Sleeve → GND

  Compatible I2C sensors can be wired to TRRS plugs for
  quick connect/disconnect (e.g., pulse oximeter, temp sensor)
```

---

## Testing Checklist

After assembly:

- [ ] Check for shorts between 3.3V, 5V, and GND
- [ ] Insert ESP32 module
- [ ] Connect USB-C power - D1 (power LED) should illuminate
- [ ] Check 3.3V and 5V rails with multimeter
- [ ] Connect OLED - should show boot screen
- [ ] Test buttons - LEDs should light when GPIO driven
- [ ] Test encoder - rotating should move selection up/down
- [ ] Test Neopixel - should show connection status color

Optional expansions (if populated):

- [ ] AD8232: Attach electrodes, verify analog signal on GPIO 3
- [ ] AD8232: LO+/LO- go HIGH when leads disconnected
- [ ] AD8232: D3 (heartbeat LED) pulses with detected beats
- [ ] I2C TRRS: Scan for devices with I2C scanner sketch
- [ ] I2C TRRS: Verify 3.3V on Ring2, GND on Sleeve
- [ ] I2C TRRS: D2 (blue LED) lights when device detected

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
