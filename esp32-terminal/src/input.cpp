// Input Handler Implementation
#include "input.h"
#include "config.h"
#include <ESP32Encoder.h>

#define LONG_PRESS_MS 600

// Button debounce state
static bool lastYesState = true;  // HIGH when not pressed (pullup)
static bool lastNoState = true;
static unsigned long lastYesChange = 0;
static unsigned long lastNoChange = 0;

// Long press tracking: start timing on press, fire normal on release if not long
static bool yesPressing = false;
static unsigned long yesPressStart = 0;
static bool yesLongFired = false;

static bool noPressing = false;
static unsigned long noPressStart = 0;
static bool noLongFired = false;

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

    // === Check YES button ===
    bool yesState = digitalRead(PIN_BTN_YES);
    if (yesState != lastYesState) {
        if (now - lastYesChange > DEBOUNCE_MS) {
            lastYesChange = now;
            lastYesState = yesState;

            if (yesState == LOW) {
                // Button pressed — start long press timer
                yesPressing = true;
                yesPressStart = now;
                yesLongFired = false;
            } else {
                // Button released — fire normal press if long press didn't already fire
                if (yesPressing && !yesLongFired) {
                    yesPressing = false;
                    return InputEvent::YES;
                }
                yesPressing = false;
            }
        }
    }

    // Check YES long press threshold while button is held
    if (yesPressing && !yesLongFired && (now - yesPressStart >= LONG_PRESS_MS)) {
        yesLongFired = true;
        return InputEvent::LONG_YES;
    }

    // === Check NO button ===
    bool noState = digitalRead(PIN_BTN_NO);
    if (noState != lastNoState) {
        if (now - lastNoChange > DEBOUNCE_MS) {
            lastNoChange = now;
            lastNoState = noState;

            if (noState == LOW) {
                // Button pressed — start long press timer
                noPressing = true;
                noPressStart = now;
                noLongFired = false;
            } else {
                // Button released — fire normal press if long press didn't already fire
                if (noPressing && !noLongFired) {
                    noPressing = false;
                    return InputEvent::NO;
                }
                noPressing = false;
            }
        }
    }

    // Check NO long press threshold while button is held
    if (noPressing && !noLongFired && (now - noPressStart >= LONG_PRESS_MS)) {
        noLongFired = true;
        return InputEvent::LONG_NO;
    }

    // === Check rotary encoder ===
    if (now - lastEncoderPoll > ENCODER_POLL_MS) {
        lastEncoderPoll = now;

        int32_t currentCount = encoder.getCount();
        int32_t diff = currentCount - lastEncoderCount;

        if (diff >= ENCODER_PULSES_PER_DETENT) {
            lastEncoderCount += ENCODER_PULSES_PER_DETENT;
            return InputEvent::DOWN;
        } else if (diff <= -ENCODER_PULSES_PER_DETENT) {
            lastEncoderCount -= ENCODER_PULSES_PER_DETENT;
            return InputEvent::UP;
        }
    }

    return InputEvent::NONE;
}

uint8_t inputGetRotaryPosition() {
    int32_t count = encoder.getCount() / ENCODER_PULSES_PER_DETENT;
    int pos = ((count % 8) + 8) % 8 + 1;
    return (uint8_t)pos;
}

// Encoder button tap detection — returns true once on a short press (< 500 ms)
static bool lastEncoderBtnState = true;  // HIGH = not pressed (pullup)
static unsigned long lastEncoderBtnChange = 0;

bool inputCheckEncoderTap() {
    bool state = digitalRead(PIN_ENCODER_SW);
    if (state != lastEncoderBtnState && (millis() - lastEncoderBtnChange > DEBOUNCE_MS)) {
        unsigned long now = millis();
        lastEncoderBtnChange = now;
        lastEncoderBtnState = state;
        if (state == HIGH) {  // Released — tap detected if held < 500 ms
            if (now - lastEncoderBtnChange < 500) return true;
        }
    }
    return false;
}
