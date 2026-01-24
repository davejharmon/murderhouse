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
#define WS_HOST "192.168.86.85"
#define WS_PORT 8080
#define WS_PATH "/"

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
// PIN DEFINITIONS - ROTARY SWITCH - ESP32-S3
// ============================================================================

#define PIN_ROTARY_ADC  1   // ADC1_CH0 input for resistor ladder

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

// Series resistor ladder: 3.3V--[500]--Pos1--[1k]--Pos2--...--Pos8--[500]--GND
// Total resistance: 8kΩ, giving linear voltage distribution
// ADC values: Pos1=3834, Pos2=3327, Pos3=2817, Pos4=2308, Pos5=1787, Pos6=1278, Pos7=769, Pos8=261
// Using midpoints for threshold detection
#define ROTARY_POS_1_MIN  3580  // > 3580 = Position 1
#define ROTARY_POS_2_MIN  3072  // 3072-3580 = Position 2
#define ROTARY_POS_3_MIN  2562  // 2562-3072 = Position 3
#define ROTARY_POS_4_MIN  2048  // 2048-2562 = Position 4
#define ROTARY_POS_5_MIN  1532  // 1532-2048 = Position 5
#define ROTARY_POS_6_MIN  1024  // 1024-1532 = Position 6
#define ROTARY_POS_7_MIN  515   // 515-1024 = Position 7
#define ROTARY_POS_8_MIN  100   // 100-515 = Position 8
// < 100 = No position / disconnected

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
