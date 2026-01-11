// LED Controller Implementation
#include "leds.h"
#include "config.h"
#include <Adafruit_NeoPixel.h>

// Neopixel instance (1 pixel)
static Adafruit_NeoPixel neopixel(1, PIN_NEOPIXEL, NEO_GRB + NEO_KHZ800);

// Current LED states
static LedState yesLedState = LedState::OFF;
static LedState noLedState = LedState::OFF;

// Current neopixel target color
static uint8_t statusR = 0, statusG = 0, statusB = 0;
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
    uint8_t brightness = LED_OFF;

    switch (state) {
        case LedState::OFF:
            brightness = LED_OFF;
            break;
        case LedState::DIM:
            brightness = LED_DIM;
            break;
        case LedState::BRIGHT:
            brightness = LED_BRIGHT;
            break;
        case LedState::PULSE:
            // Calculate pulsing brightness
            brightness = (uint8_t)(LED_DIM + (LED_BRIGHT - LED_DIM) * getPulseBrightness());
            break;
    }

    ledcWrite(channel, brightness);
}

void ledsInit() {
    // Initialize PWM for button LEDs
    ledcSetup(PWM_CHANNEL_YES, PWM_FREQ, PWM_RESOLUTION);
    ledcSetup(PWM_CHANNEL_NO, PWM_FREQ, PWM_RESOLUTION);

    ledcAttachPin(PIN_LED_YES, PWM_CHANNEL_YES);
    ledcAttachPin(PIN_LED_NO, PWM_CHANNEL_NO);

    // Start with LEDs off
    ledcWrite(PWM_CHANNEL_YES, 0);
    ledcWrite(PWM_CHANNEL_NO, 0);

    // Initialize Neopixel
    neopixel.begin();
    neopixel.setBrightness(50);  // 50/255 brightness
    neopixel.clear();
    neopixel.show();
}

void ledsUpdate() {
    unsigned long now = millis();

    // Update pulse animation (~60 fps)
    if (now - lastPulseUpdate > 16) {
        lastPulseUpdate = now;

        // Advance pulse phase (complete cycle in LED_PULSE_MS)
        pulsePhase += (2.0f * PI * 16.0f) / LED_PULSE_MS;
        if (pulsePhase > 2.0f * PI) {
            pulsePhase -= 2.0f * PI;
        }

        // Update button LEDs if pulsing
        if (yesLedState == LedState::PULSE) {
            applyLedState(PWM_CHANNEL_YES, LedState::PULSE);
        }
        if (noLedState == LedState::PULSE) {
            applyLedState(PWM_CHANNEL_NO, LedState::PULSE);
        }

        // Update neopixel if pulsing
        if (statusPulse) {
            float brightness = getPulseBrightness();
            neopixel.setPixelColor(0, neopixel.Color(
                (uint8_t)(statusR * brightness),
                (uint8_t)(statusG * brightness),
                (uint8_t)(statusB * brightness)
            ));
            neopixel.show();
        }
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
    statusR = r;
    statusG = g;
    statusB = b;
    statusPulse = false;

    neopixel.setPixelColor(0, neopixel.Color(r, g, b));
    neopixel.show();
}

void ledsSetStatus(ConnectionState state) {
    switch (state) {
        case ConnectionState::BOOT:
            // White - initializing
            statusR = 100; statusG = 100; statusB = 100;
            statusPulse = false;
            break;

        case ConnectionState::WIFI_CONNECTING:
            // Blue - connecting to WiFi
            statusR = 0; statusG = 0; statusB = 255;
            statusPulse = true;
            break;

        case ConnectionState::WS_CONNECTING:
            // Yellow - connecting to WebSocket
            statusR = 255; statusG = 200; statusB = 0;
            statusPulse = true;
            break;

        case ConnectionState::JOINING:
            // Cyan - joining game
            statusR = 0; statusG = 255; statusB = 255;
            statusPulse = false;
            break;

        case ConnectionState::CONNECTED:
            // Green - connected
            statusR = 0; statusG = 255; statusB = 0;
            statusPulse = false;
            break;

        case ConnectionState::RECONNECTING:
            // Orange - reconnecting
            statusR = 255; statusG = 100; statusB = 0;
            statusPulse = true;
            break;

        case ConnectionState::ERROR:
            // Red - error
            statusR = 255; statusG = 0; statusB = 0;
            statusPulse = false;
            break;
    }

    if (!statusPulse) {
        neopixel.setPixelColor(0, neopixel.Color(statusR, statusG, statusB));
        neopixel.show();
    }
}

void ledsOff() {
    ledsSetYes(LedState::OFF);
    ledsSetNo(LedState::OFF);
    statusPulse = false;
    neopixel.clear();
    neopixel.show();
}
