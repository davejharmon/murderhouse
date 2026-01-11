// Input Handler Implementation
#include "input.h"
#include "config.h"

// Button state tracking
static bool lastYesState = true;  // HIGH when not pressed (pullup)
static bool lastNoState = true;
static unsigned long lastYesChange = 0;
static unsigned long lastNoChange = 0;

// Rotary switch tracking
static uint8_t lastRotaryPos = 0;
static unsigned long lastRotaryRead = 0;

// Read the rotary switch position from ADC
static uint8_t readRotaryPosition() {
    int adcValue = analogRead(PIN_ROTARY_ADC);

    // Determine position based on ADC thresholds
    if (adcValue > ROTARY_POS_1_MIN) return 1;
    if (adcValue > ROTARY_POS_2_MIN) return 2;
    if (adcValue > ROTARY_POS_3_MIN) return 3;
    if (adcValue > ROTARY_POS_4_MIN) return 4;
    if (adcValue > ROTARY_POS_5_MIN) return 5;
    if (adcValue > ROTARY_POS_6_MIN) return 6;
    if (adcValue > ROTARY_POS_7_MIN) return 7;
    if (adcValue > ROTARY_POS_8_MIN) return 8;

    return 0;  // No valid position (disconnected or between positions)
}

void inputInit() {
    // Configure button pins with internal pullup
    pinMode(PIN_BTN_YES, INPUT_PULLUP);
    pinMode(PIN_BTN_NO, INPUT_PULLUP);

    // Configure rotary ADC pin
    pinMode(PIN_ROTARY_ADC, INPUT);

    // Set ADC resolution to 12 bits (0-4095)
    analogReadResolution(12);

    // Initialize rotary position
    lastRotaryPos = readRotaryPosition();

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

    // === Check rotary switch ===
    if (now - lastRotaryRead > ROTARY_READ_MS) {
        lastRotaryRead = now;

        uint8_t currentPos = readRotaryPosition();

        // Only process if we have a valid position and it changed
        if (currentPos > 0 && currentPos != lastRotaryPos && lastRotaryPos > 0) {
            // Determine direction
            // Clockwise (increasing position) = DOWN
            // Counter-clockwise (decreasing position) = UP

            // Handle wraparound (8 -> 1 is clockwise, 1 -> 8 is counter-clockwise)
            int8_t diff = (int8_t)currentPos - (int8_t)lastRotaryPos;

            // Adjust for wraparound
            if (diff > 4) {
                diff -= 8;  // e.g., 8 - 1 = 7, adjusted to -1
            } else if (diff < -4) {
                diff += 8;  // e.g., 1 - 8 = -7, adjusted to 1
            }

            lastRotaryPos = currentPos;

            if (diff > 0) {
                // Clockwise = position increased = DOWN (next target)
                return InputEvent::DOWN;
            } else if (diff < 0) {
                // Counter-clockwise = position decreased = UP (previous target)
                return InputEvent::UP;
            }
        } else if (currentPos > 0) {
            // Just update position if it's valid
            lastRotaryPos = currentPos;
        }
    }

    return InputEvent::NONE;
}

uint8_t inputGetRotaryPosition() {
    return lastRotaryPos;
}
