// ESP32 Terminal Configuration
#ifndef CONFIG_H
#define CONFIG_H

// ============================================================================
// NETWORK CONFIGURATION
// ============================================================================

// WiFi credentials - UPDATE THESE FOR YOUR NETWORK
#define WIFI_SSID "Paul Anka"
#define WIFI_PASSWORD "andywarhol"

// WebSocket server - discovered automatically via UDP broadcast
#define WS_PORT 8080
#define WS_PATH "/"

// UDP discovery
#define DISCOVERY_PORT       8089
#define DISCOVERY_TIMEOUT_MS 3000
#define DISCOVERY_MSG        "MURDERHOUSE_DISCOVER"
#define DISCOVERY_RESP       "MURDERHOUSE_SERVER:"

// Player ID is now selected at boot via dial (1-9)
// The player ID will be set dynamically as "player-N" where N is 1-9

// ============================================================================
// PIN DEFINITIONS - SSD1322 OLED (SPI) - ESP32-S3
// ============================================================================

#define PIN_OLED_MOSI   11  // DIN - SPI2 MOSI
#define PIN_OLED_CLK    12  // CLK - SPI2 SCK
#define PIN_OLED_CS     10  // CS  - SPI2 CS0
#define PIN_OLED_DC     9   // Data/Command
#define PIN_OLED_RST    14  // Reset

// ============================================================================
// PIN DEFINITIONS - BUTTONS - ESP32-S3
// ============================================================================

// YES button (green arcade button)
#define PIN_BTN_YES     4   // Button input (pulled up, active LOW)
#define PIN_LED_YES     5   // LED output (PWM)

// NO button (red arcade button)
#define PIN_BTN_NO      6   // Button input (pulled up, active LOW)
#define PIN_LED_NO      7   // LED output (PWM)

// ============================================================================
// PIN DEFINITIONS - ROTARY ENCODER - ESP32-S3
// ============================================================================

#define PIN_ENCODER_A   1   // Encoder A (CLK) signal
#define PIN_ENCODER_B   2   // Encoder B (DT) signal
#define PIN_ENCODER_SW  42  // Encoder push button (directly to GPIO, active LOW)

// ============================================================================
// PIN DEFINITIONS - STATUS LED - ESP32-S3
// ============================================================================

#ifdef PIN_NEOPIXEL
#undef PIN_NEOPIXEL
#endif
#define PIN_NEOPIXEL    8   // WS2811 data pin

// ============================================================================
// TIMING CONFIGURATION
// ============================================================================

// Button debounce time in milliseconds
#define DEBOUNCE_MS     50

// Rotary encoder poll interval
#define ENCODER_POLL_MS  10

// LED pulse period in milliseconds
#define LED_PULSE_MS    1000

// WiFi connection timeout
#define WIFI_TIMEOUT_MS 30000

// WebSocket reconnect delay
#define WS_RECONNECT_MS 3000

// ============================================================================
// ROTARY ENCODER CONFIGURATION
// ============================================================================

// Pulses per detent (most EC11 encoders have 4 pulses per detent)
// Set to 4 for full-step counting, 1 for quarter-step (more sensitive)
#define ENCODER_PULSES_PER_DETENT  4

// ============================================================================
// LED PWM CONFIGURATION
// ============================================================================

// PWM channels (ESP32 has 16 channels, 0-15)
#define PWM_CHANNEL_YES  0
#define PWM_CHANNEL_NO   1

// PWM frequency and resolution
#define PWM_FREQ         5000  // 5 kHz
#define PWM_RESOLUTION   8     // 8-bit (0-255)

// LED brightness levels
#define LED_OFF          0
#define LED_DIM          76    // ~30%
#define LED_BRIGHT       255   // 100%

// ============================================================================
// DISPLAY CONFIGURATION
// ============================================================================

// Display dimensions
#define DISPLAY_WIDTH    256
#define DISPLAY_HEIGHT   64

// Font sizes (approximate pixel heights)
#define FONT_SMALL_HEIGHT  12
#define FONT_LARGE_HEIGHT  24

#endif // CONFIG_H
