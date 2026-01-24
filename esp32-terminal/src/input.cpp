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
static uint8_t pendingRotaryPos = 0;
static uint8_t confirmCount = 0;
static unsigned long lastRotaryRead = 0;

// Lockout tracking - prevents bouncing back to previous position
static uint8_t lockedOutPos = 0;       // Position we won't accept during lockout
static unsigned long lockoutExpiry = 0; // When lockout ends

// Number of consecutive reads required to confirm a position change
#define ROTARY_CONFIRM_COUNT 3

// Number of ADC samples to average
#define ROTARY_ADC_SAMPLES 4

// Lockout duration after confirming a change (ms)
// During this time, readings matching the old position are ignored
#define ROTARY_LOCKOUT_MS 250

// Read the rotary switch position from ADC with averaging
static uint8_t readRotaryPosition() {
    // Take multiple samples and average them
    int32_t adcSum = 0;
    for (int i = 0; i < ROTARY_ADC_SAMPLES; i++) {
        adcSum += analogRead(PIN_ROTARY_ADC);
    }
    int adcValue = adcSum / ROTARY_ADC_SAMPLES;

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

        // Ignore invalid readings
        if (currentPos == 0) {
            return InputEvent::NONE;
        }

        // Check if we're in lockout period and reading the locked-out position
        // This prevents bouncing back to the previous position after a change
        if (lockedOutPos != 0 && currentPos == lockedOutPos) {
            if (now < lockoutExpiry) {
                // Still in lockout - ignore this reading
                return InputEvent::NONE;
            } else {
                // Lockout expired - clear it
                lockedOutPos = 0;
            }
        }

        // If position matches confirmed position, reset pending state
        if (currentPos == lastRotaryPos) {
            pendingRotaryPos = 0;
            confirmCount = 0;
            return InputEvent::NONE;
        }

        // Position is different from confirmed - check if it matches pending
        if (currentPos == pendingRotaryPos) {
            // Same as pending, increment confirmation counter
            confirmCount++;

            if (confirmCount >= ROTARY_CONFIRM_COUNT) {
                // Position confirmed! Calculate direction and update
                uint8_t oldPos = lastRotaryPos;
                int8_t diff = (int8_t)currentPos - (int8_t)oldPos;

                // Adjust for wraparound
                if (diff > 4) {
                    diff -= 8;  // e.g., 8 - 1 = 7, adjusted to -1
                } else if (diff < -4) {
                    diff += 8;  // e.g., 1 - 8 = -7, adjusted to 1
                }

                lastRotaryPos = currentPos;
                pendingRotaryPos = 0;
                confirmCount = 0;

                // Set lockout to prevent bouncing back to old position
                lockedOutPos = oldPos;
                lockoutExpiry = now + ROTARY_LOCKOUT_MS;

                if (diff > 0) {
                    // Clockwise = position increased = DOWN (next target)
                    return InputEvent::DOWN;
                } else if (diff < 0) {
                    // Counter-clockwise = position decreased = UP (previous target)
                    return InputEvent::UP;
                }
            }
        } else {
            // Different position than pending - start new pending
            pendingRotaryPos = currentPos;
            confirmCount = 1;
        }
    }

    return InputEvent::NONE;
}

uint8_t inputGetRotaryPosition() {
    return lastRotaryPos;
}
