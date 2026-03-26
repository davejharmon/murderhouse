// LED Controller Implementation
#include "leds.h"
#include "config.h"
#include <Adafruit_NeoPixel.h>

// Neopixel instance (1 pixel)
static Adafruit_NeoPixel neopixel(1, PIN_NEOPIXEL, NEOPIXEL_ORDER + NEO_KHZ800);

// Current LED states
static LedState yesLedState = LedState::OFF;
static LedState noLedState = LedState::OFF;

// Neopixel fade: current (display) and target colors
static float curR = 0, curG = 0, curB = 0;
static float tgtR = 0, tgtG = 0, tgtB = 0;
static bool statusPulse = false;

// Pulse animation state
static unsigned long lastPulseUpdate = 0;
static float pulsePhase = 0;

// Calculate pulse brightness (0.0 to 1.0)
static float getPulseBrightness() {
    // Sine wave from 0.2 to 1.0
    return 0.2f + 0.8f * (0.5f + 0.5f * sin(pulsePhase));
}

// Apply LED state to PWM output
static void applyLedState(uint8_t channel, LedState state) {
    uint8_t bright = (channel == PWM_CHANNEL_NO) ? LED_BRIGHT_NO : LED_BRIGHT;
    uint8_t brightness = LED_OFF;

    switch (state) {
        case LedState::OFF:
            brightness = LED_OFF;
            break;
        case LedState::DIM:
            brightness = LED_DIM;
            break;
        case LedState::BRIGHT:
            brightness = bright;
            break;
        case LedState::PULSE:
            // Treat pulse same as bright for button LEDs
            brightness = bright;
            break;
    }

    ledcWrite(channel, brightness);
}

void ledsInit() {
    // Initialize PWM for button LEDs
    ledcSetup(PWM_CHANNEL_YES, PWM_FREQ, PWM_RESOLUTION);
    ledcSetup(PWM_CHANNEL_NO, PWM_FREQ, PWM_RESOLUTION);
    ledcSetup(PWM_CHANNEL_POWER, PWM_FREQ, PWM_RESOLUTION);

    ledcAttachPin(PIN_LED_YES, PWM_CHANNEL_YES);
    ledcAttachPin(PIN_LED_NO, PWM_CHANNEL_NO);
    ledcAttachPin(PIN_LED_POWER, PWM_CHANNEL_POWER);

    // Start with LEDs off (power LED on at low brightness)
    ledcWrite(PWM_CHANNEL_YES, 0);
    ledcWrite(PWM_CHANNEL_NO, 0);
    ledcWrite(PWM_CHANNEL_POWER, LED_POWER_BRIGHT);

    // Initialize Neopixel
    neopixel.begin();
    neopixel.setBrightness(25);  // 25/255 brightness
    neopixel.clear();
    neopixel.show();
}

void ledsUpdate() {
    unsigned long now = millis();

    // Update at ~60 fps
    if (now - lastPulseUpdate > 16) {
        lastPulseUpdate = now;

        // Advance pulse phase (complete cycle in LED_PULSE_MS)
        pulsePhase += (2.0f * PI * 16.0f) / LED_PULSE_MS;
        if (pulsePhase > 2.0f * PI) {
            pulsePhase -= 2.0f * PI;
        }

        // Fade current color toward target (~500ms transition)
        float step = 16.0f / LED_FADE_MS;  // fraction per frame at ~60fps
        if (step > 1.0f) step = 1.0f;
        curR += (tgtR - curR) * step;
        curG += (tgtG - curG) * step;
        curB += (tgtB - curB) * step;

        // Apply pulse modulation or solid color
        float brightness = statusPulse ? getPulseBrightness() : 1.0f;
        neopixel.setPixelColor(0, neopixel.Color(
            (uint8_t)(curR * brightness),
            (uint8_t)(curG * brightness),
            (uint8_t)(curB * brightness)
        ));
        neopixel.show();
    }
}

void ledsSetYes(LedState state) {
    yesLedState = state;
    applyLedState(PWM_CHANNEL_YES, state);
}

void ledsSetNo(LedState state) {
    noLedState = state;
    applyLedState(PWM_CHANNEL_NO, state);
}

void ledsSetFromDisplay(const DisplayState& state) {
    ledsSetYes(state.leds.yes);
    ledsSetNo(state.leds.no);
}

void ledsSetStatusColor(uint8_t r, uint8_t g, uint8_t b) {
    tgtR = r; tgtG = g; tgtB = b;
    statusPulse = false;
}

void ledsSetStatus(ConnectionState state) {
    switch (state) {
        case ConnectionState::BOOT:
            // White - initializing
            tgtR = 100; tgtG = 100; tgtB = 100;
            statusPulse = false;
            break;

        case ConnectionState::PLAYER_SELECT:
            // Purple - selecting player
            tgtR = 150; tgtG = 0; tgtB = 255;
            statusPulse = true;
            break;

        case ConnectionState::WIFI_CONNECTING:
            // Blue - connecting to WiFi
            tgtR = 0; tgtG = 0; tgtB = 255;
            statusPulse = true;
            break;

        case ConnectionState::WS_CONNECTING:
            // Yellow - connecting to WebSocket
            tgtR = 255; tgtG = 200; tgtB = 0;
            statusPulse = true;
            break;

        case ConnectionState::JOINING:
            // Cyan - joining game
            tgtR = 0; tgtG = 255; tgtB = 255;
            statusPulse = false;
            break;

        case ConnectionState::CONNECTED:
            // Green - connected
            tgtR = 0; tgtG = 255; tgtB = 0;
            statusPulse = false;
            break;

        case ConnectionState::RECONNECTING:
            // Orange - reconnecting
            tgtR = 255; tgtG = 100; tgtB = 0;
            statusPulse = true;
            break;

        case ConnectionState::ERROR:
            // Red - error
            tgtR = 255; tgtG = 0; tgtB = 0;
            statusPulse = false;
            break;
    }
}

void ledsSetGameState(GameLedState state) {
    switch (state) {
        case GameLedState::NONE:
            // No game state - don't change neopixel
            return;

        case GameLedState::OFF:
            tgtR = 0; tgtG = 0; tgtB = 0;
            statusPulse = false;
            break;

        case GameLedState::LOBBY:
            tgtR = 100; tgtG = 100; tgtB = 100;
            statusPulse = false;
            break;

        case GameLedState::DAY:
            tgtR = 0; tgtG = 255; tgtB = 0;
            statusPulse = false;
            break;

        case GameLedState::NIGHT:
            tgtR = 0; tgtG = 0; tgtB = 255;
            statusPulse = false;
            break;

        case GameLedState::VOTING:
            tgtR = 255; tgtG = 200; tgtB = 0;
            statusPulse = true;
            break;

        case GameLedState::LOCKED:
            tgtR = 0; tgtG = 255; tgtB = 0;
            statusPulse = false;
            break;

        case GameLedState::ABSTAINED:
            tgtR = 60; tgtG = 60; tgtB = 60;
            statusPulse = false;
            break;

        case GameLedState::DEAD:
            tgtR = 255; tgtG = 0; tgtB = 0;
            statusPulse = false;
            break;

        case GameLedState::GAME_OVER:
            tgtR = 100; tgtG = 100; tgtB = 100;
            statusPulse = false;
            break;
    }
}

void ledsOff() {
    ledsSetYes(LedState::OFF);
    ledsSetNo(LedState::OFF);
    tgtR = 0; tgtG = 0; tgtB = 0;
    curR = 0; curG = 0; curB = 0;
    statusPulse = false;
    neopixel.clear();
    neopixel.show();
}
