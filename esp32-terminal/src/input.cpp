// Input Handler Implementation
#include "input.h"
#include "config.h"
#include <ESP32Encoder.h>

// Button state tracking
static bool lastYesState = true;  // HIGH when not pressed (pullup)
static bool lastNoState = true;
static unsigned long lastYesChange = 0;
static unsigned long lastNoChange = 0;

// Rotary encoder
static ESP32Encoder encoder;
static int32_t lastEncoderCount = 0;
static unsigned long lastEncoderPoll = 0;

void inputInit() {
    // Configure button pins with internal pullup
    pinMode(PIN_BTN_YES, INPUT_PULLUP);
    pinMode(PIN_BTN_NO, INPUT_PULLUP);
    pinMode(PIN_ENCODER_SW, INPUT_PULLUP);

    // Initialize rotary encoder
    // Use full quadrature mode for accurate counting
    ESP32Encoder::useInternalWeakPullResistors = puType::up;
    encoder.attachFullQuad(PIN_ENCODER_A, PIN_ENCODER_B);
    encoder.clearCount();
    lastEncoderCount = 0;

    // Initialize button states
    lastYesState = digitalRead(PIN_BTN_YES);
    lastNoState = digitalRead(PIN_BTN_NO);
}

InputEvent inputPoll() {
    unsigned long now = millis();
    InputEvent event = InputEvent::NONE;

    // === Check YES button ===
    bool yesState = digitalRead(PIN_BTN_YES);
    if (yesState != lastYesState) {
        if (now - lastYesChange > DEBOUNCE_MS) {
            lastYesChange = now;
            lastYesState = yesState;

            // Button pressed (LOW because of pullup)
            if (yesState == LOW) {
                return InputEvent::YES;
            }
        }
    }

    // === Check NO button ===
    bool noState = digitalRead(PIN_BTN_NO);
    if (noState != lastNoState) {
        if (now - lastNoChange > DEBOUNCE_MS) {
            lastNoChange = now;
            lastNoState = noState;

            // Button pressed (LOW because of pullup)
            if (noState == LOW) {
                return InputEvent::NO;
            }
        }
    }

    // === Check rotary encoder ===
    if (now - lastEncoderPoll > ENCODER_POLL_MS) {
        lastEncoderPoll = now;

        int32_t currentCount = encoder.getCount();
        int32_t diff = currentCount - lastEncoderCount;

        // Check if we've moved enough for a detent
        if (diff >= ENCODER_PULSES_PER_DETENT) {
            // Clockwise rotation = DOWN (next item)
            lastEncoderCount += ENCODER_PULSES_PER_DETENT;
            return InputEvent::DOWN;
        } else if (diff <= -ENCODER_PULSES_PER_DETENT) {
            // Counter-clockwise rotation = UP (previous item)
            lastEncoderCount -= ENCODER_PULSES_PER_DETENT;
            return InputEvent::UP;
        }
    }

    return InputEvent::NONE;
}

uint8_t inputGetRotaryPosition() {
    // For encoder, return a pseudo-position based on count
    // This maintains API compatibility but isn't meaningful for encoders
    int32_t count = encoder.getCount() / ENCODER_PULSES_PER_DETENT;
    // Wrap to 1-8 range for compatibility
    int pos = ((count % 8) + 8) % 8 + 1;
    return (uint8_t)pos;
}
