// ESP32 Terminal Configuration
#ifndef CONFIG_H
#define CONFIG_H

// ============================================================================
// NETWORK CONFIGURATION
// ============================================================================

// WiFi credentials - UPDATE THESE FOR YOUR NETWORK
#define WIFI_SSID "Paul Anka"
#define WIFI_PASSWORD "andywarhol"

// WebSocket server - UPDATE FOR YOUR SERVER
#define WS_HOST "192.168.1.100"
#define WS_PORT 8080
#define WS_PATH "/"

// Unique player ID for this terminal
// Each physical terminal should have a unique ID
#define PLAYER_ID "esp32-terminal-001"

// ============================================================================
// PIN DEFINITIONS - SSD1322 OLED (SPI)
// ============================================================================

#define PIN_OLED_MOSI   23  // DIN - VSPI MOSI
#define PIN_OLED_CLK    18  // CLK - VSPI SCK
#define PIN_OLED_CS     5   // CS  - VSPI CS0
#define PIN_OLED_DC     16  // Data/Command
#define PIN_OLED_RST    17  // Reset

// ============================================================================
// PIN DEFINITIONS - BUTTONS
// ============================================================================

// YES button (green arcade button)
#define PIN_BTN_YES     32  // Button input (pulled up, active LOW)
#define PIN_LED_YES     25  // LED output (PWM)

// NO button (red arcade button)
#define PIN_BTN_NO      33  // Button input (pulled up, active LOW)
#define PIN_LED_NO      26  // LED output (PWM)

// ============================================================================
// PIN DEFINITIONS - ROTARY SWITCH
// ============================================================================

#define PIN_ROTARY_ADC  34  // ADC input for resistor ladder

// ============================================================================
// PIN DEFINITIONS - STATUS LED
// ============================================================================

#define PIN_NEOPIXEL    27  // WS2811 data pin

// ============================================================================
// TIMING CONFIGURATION
// ============================================================================

// Button debounce time in milliseconds
#define DEBOUNCE_MS     50

// Rotary switch read interval
#define ROTARY_READ_MS  20

// LED pulse period in milliseconds
#define LED_PULSE_MS    1000

// WiFi connection timeout
#define WIFI_TIMEOUT_MS 30000

// WebSocket reconnect delay
#define WS_RECONNECT_MS 3000

// ============================================================================
// ROTARY SWITCH ADC THRESHOLDS
// ============================================================================

// ADC values for each rotary position (midpoints between expected values)
// Position 1: ~3723, Position 2: ~3413, Position 3: ~3151, etc.
// Using midpoints for threshold detection
#define ROTARY_POS_1_MIN  3550  // > 3550 = Position 1
#define ROTARY_POS_2_MIN  3280  // 3280-3550 = Position 2
#define ROTARY_POS_3_MIN  2960  // 2960-3280 = Position 3
#define ROTARY_POS_4_MIN  2600  // 2600-2960 = Position 4
#define ROTARY_POS_5_MIN  2240  // 2240-2600 = Position 5
#define ROTARY_POS_6_MIN  1840  // 1840-2240 = Position 6
#define ROTARY_POS_7_MIN  1450  // 1450-1840 = Position 7
#define ROTARY_POS_8_MIN  1000  // 1000-1450 = Position 8
// < 1000 = No position / disconnected

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
