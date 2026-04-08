// ESP32 Physical Terminal for Murderhouse
// Main Application Entry Point

#include <Arduino.h>
#include "config.h"
#include "protocol.h"
#include "display.h"
#include "input.h"
#include "leds.h"
#include "heartrate.h"
#include "network.h"
#include "player_select.h"

// Core game-loop state
static DisplayState currentDisplay;
static bool displayDirty = true;
static bool terminalOwnsDisplay = false;
static ConnectionState lastConnState = ConnectionState::BOOT;

// Settle timer: sends selectTo after dial stops moving during target selection
static unsigned long lastScrollMs = 0;
static bool settlePending = false;
static const unsigned long SCROLL_SETTLE_MS = 150;

// Reset detection (hold encoder button 3 s to prompt, 5 s total to restart)
static unsigned long encoderBtnHeldSince = 0;
static bool resetMessageShown = false;
static const unsigned long RESET_HOLD_MS = 3000;
static const unsigned long RESET_CONFIRM_MS = 2000;

// Returns true while reset gesture is pending (caller should skip normal input)
bool checkResetGesture() {
    unsigned long now = millis();

    if (digitalRead(PIN_ENCODER_SW) == LOW) {
        if (encoderBtnHeldSince == 0) {
            encoderBtnHeldSince = now;
            resetMessageShown = false;
            Serial.println("Encoder button held - reset timer started");
        }

        unsigned long heldFor = now - encoderBtnHeldSince;

        if (heldFor >= RESET_HOLD_MS && !resetMessageShown) {
            Serial.println("Showing restart message...");
            displayMessage("HOLD TO CONFIRM", "RESTARTING", "Release to cancel");
            ledsSetYes(LedState::BRIGHT);
            ledsSetNo(LedState::BRIGHT);
            resetMessageShown = true;
        }

        if (heldFor >= RESET_HOLD_MS + RESET_CONFIRM_MS) {
            Serial.println("Restarting terminal...");
            displayMessage("", "RESTARTING...", "");
            delay(500);
            ESP.restart();
        }

        return resetMessageShown;
    } else {
        if (encoderBtnHeldSince != 0) {
            if (resetMessageShown) {
                Serial.println("Reset cancelled");
                if (!psIsConfirmed()) {
                    displayPlayerSelect(psGetSelectedPlayer());
                } else {
                    displayDirty = true;
                }
            }
            encoderBtnHeldSince = 0;
            resetMessageShown = false;
        }
        return false;
    }
}

// Callback when display state is received from server
void onDisplayUpdate(const DisplayState& state) {
    if (terminalOwnsDisplay) {
        if (state.targetCount == 0) {
            terminalOwnsDisplay = false;
        } else {
            ledsSetFromDisplay(state);
            ledsSetGameState(state.statusLed);
            currentDisplay.line3 = state.line3;
            displayDirty = true;
            return;
        }
    }

    currentDisplay = state;
    displayDirty = true;

    ledsSetFromDisplay(state);
    ledsSetGameState(state.statusLed);
}

void setup() {
    Serial.begin(115200);
    Serial.println();
    Serial.println("=== Murderhouse ESP32 Terminal v" FIRMWARE_VERSION " ===");

    Serial.println("Initializing display...");
    displayInit();
    displayConnectionStatus(ConnectionState::BOOT);

    Serial.println("Initializing LEDs...");
    ledsInit();
    ledsSetStatus(ConnectionState::BOOT);

    Serial.println("Testing button LEDs...");
    ledsSetYes(LedState::BRIGHT);
    ledsSetNo(LedState::BRIGHT);
    delay(500);
    ledsSetYes(LedState::OFF);
    ledsSetNo(LedState::OFF);

    Serial.println("Initializing heart rate monitor...");
    heartrateInit();
    heartrateSetSendCallback(networkSendHeartbeat);

    Serial.println("Testing heartbeat LED (D3)...");
    digitalWrite(PIN_LED_HEARTBEAT, HIGH);
    delay(500);
    digitalWrite(PIN_LED_HEARTBEAT, LOW);

    Serial.println("Initializing input...");
    inputInit();

    Serial.println("Entering player selection...");
    psInit();
    lastConnState = ConnectionState::PLAYER_SELECT;
    ledsSetStatus(ConnectionState::PLAYER_SELECT);
    ledsSetYes(LedState::BRIGHT);
    displayPlayerSelect(psGetSelectedPlayer());

    Serial.println("Use dial to select terminal (OPERATOR or PLAYER 1-9), press YES to confirm");
}

void loop() {
    ledsUpdate();
    heartrateUpdate();

    if (checkResetGesture()) {
        delay(10);
        return;
    }

    // ── Player selection (pre-network) ──────────────────────────────────────────
    if (!psIsConfirmed()) {
        psHandleInput();

        if (inputCheckEncoderTap()) {
            displayToggleScreenMode();
            psMarkDirty();
        }

        if (psIsDirty()) {
            displayPlayerSelect(psGetSelectedPlayer());
            psClearDirty();
        }

        // psHandleInput() calls networkInit() on confirm; we wire the display callback here
        if (psIsConfirmed()) {
            networkSetDisplayCallback(onDisplayUpdate);
            displayConnectionStatus(ConnectionState::WIFI_CONNECTING);  // flush display after WiFi init power spike
        } else {
            delay(1);
            return;
        }
    }

    // Allow screen mode toggle on connection screens
    if (!networkIsConnected() && inputCheckEncoderTap()) {
        displayToggleScreenMode();
        displayConnectionStatus(lastConnState);
    }

    // ── Network update ──────────────────────────────────────────────────────────
    ConnectionState connState = networkUpdate();

    if (networkWasKicked()) {
        Serial.println("Kicked — returning to player select");
        psReset();
        terminalOwnsDisplay = false;
        currentDisplay = DisplayState();
        displayPlayerSelect(psGetSelectedPlayer());
        ledsSetStatus(ConnectionState::PLAYER_SELECT);
        return;
    }

    // Connection state change
    if (connState != lastConnState) {
        lastConnState = connState;
        ledsSetStatus(connState);

        if (connState == ConnectionState::CONNECTED) {
            heartratePowerOn();
        } else if (connState == ConnectionState::RECONNECTING ||
                   connState == ConnectionState::WIFI_CONNECTING ||
                   connState == ConnectionState::PLAYER_SELECT) {
            heartratePowerOff();
        }

        if (connState != ConnectionState::CONNECTED) {
            const char* detail = (connState == ConnectionState::ERROR) ? networkGetLastError() : nullptr;
            displayConnectionStatus(connState, detail);
        }

        Serial.print("Connection state: ");
        switch (connState) {
            case ConnectionState::BOOT:            Serial.println("BOOT"); break;
            case ConnectionState::PLAYER_SELECT:   Serial.println("PLAYER_SELECT"); break;
            case ConnectionState::WIFI_CONNECTING: Serial.println("WIFI_CONNECTING"); break;
            case ConnectionState::WS_CONNECTING:   Serial.println("WS_CONNECTING"); break;
            case ConnectionState::JOINING:         Serial.println("JOINING"); break;
            case ConnectionState::CONNECTED:       Serial.println("CONNECTED"); break;
            case ConnectionState::RECONNECTING:    Serial.println("RECONNECTING"); break;
            case ConnectionState::ERROR:
                Serial.print("ERROR: ");
                Serial.println(networkGetLastError());
                break;
        }
    }

    // ── Connected input handling ─────────────────────────────────────────────────
    if (networkIsConnected()) {
        heartrateCheckAndSend();

        // === TARGET SELECTION FAST PATH ===
        if (terminalOwnsDisplay) {
            static unsigned long lastKeepAlive = 0;
            InputEvent event = inputPoll();
            switch (event) {
                case InputEvent::UP: {
                    int newIdx = (currentDisplay.selectionIndex <= 0)
                        ? currentDisplay.targetCount - 1
                        : currentDisplay.selectionIndex - 1;
                    currentDisplay.selectionIndex = newIdx;
                    currentDisplay.line2.text  = currentDisplay.targetNames[newIdx];
                    currentDisplay.line2.style = DisplayStyle::NORMAL;
                    displayDirty = true;
                    lastScrollMs = millis();
                    settlePending = true;
                    break;
                }
                case InputEvent::DOWN: {
                    int newIdx = (currentDisplay.selectionIndex < 0 ||
                                  currentDisplay.selectionIndex >= currentDisplay.targetCount - 1)
                        ? 0
                        : currentDisplay.selectionIndex + 1;
                    currentDisplay.selectionIndex = newIdx;
                    currentDisplay.line2.text  = currentDisplay.targetNames[newIdx];
                    currentDisplay.line2.style = DisplayStyle::NORMAL;
                    displayDirty = true;
                    lastScrollMs = millis();
                    settlePending = true;
                    break;
                }
                case InputEvent::YES: {
                    terminalOwnsDisplay = false;
                    int idx = currentDisplay.selectionIndex;
                    int count = currentDisplay.targetCount;
                    currentDisplay.targetCount = 0;
                    if (idx >= 0 && idx < count) {
                        networkSendConfirmWithTarget(currentDisplay.targetIds[idx].c_str());
                    } else {
                        networkSendConfirm();
                    }
                    break;
                }
                case InputEvent::NO:
                    terminalOwnsDisplay = false;
                    currentDisplay.targetCount = 0;
                    networkSendAbstain();
                    break;
                default:
                    break;
            }

            if (settlePending && (millis() - lastScrollMs >= SCROLL_SETTLE_MS)) {
                settlePending = false;
                if (currentDisplay.selectionIndex >= 0 &&
                    currentDisplay.selectionIndex < currentDisplay.targetCount) {
                    networkSendSelectTo(currentDisplay.targetIds[currentDisplay.selectionIndex].c_str());
                }
            }

            if (displayDirty) {
                displayRender(currentDisplay);
                displayDirty = false;
            }

            if (millis() - lastKeepAlive >= WS_KEEPALIVE_MS) {
                lastKeepAlive = millis();
                networkUpdate();
            }

            if (!networkIsConnected()) {
                terminalOwnsDisplay = false;
                currentDisplay.targetCount = 0;
            } else {
                delay(1);
                return;
            }
        }

        if (currentDisplay.targetCount > 0) {
            terminalOwnsDisplay = true;
            ledsSetYes(LedState::BRIGHT);
            ledsSetNo(LedState::BRIGHT);
        }

        InputEvent event = inputPoll();

        if (networkIsOperatorMode()) {
            networkOperatorTick();

            switch (event) {
                case InputEvent::UP:
                    if (!networkIsOperatorReady()) networkOperatorScrollUp();
                    break;
                case InputEvent::DOWN:
                    if (!networkIsOperatorReady()) networkOperatorScrollDown();
                    break;
                case InputEvent::YES:
                    if (!networkIsOperatorReady()) {
                        Serial.println("Operator: add word");
                        networkSendOperatorAdd();
                    }
                    break;
                case InputEvent::NO:
                    if (networkIsOperatorReady()) {
                        Serial.println("Operator: cancel ready");
                        networkSendOperatorUnready();
                    } else {
                        Serial.println("Operator: delete word");
                        networkSendOperatorDelete();
                    }
                    break;
                case InputEvent::LONG_YES:
                    if (!networkIsOperatorReady()) {
                        Serial.println("Operator: long YES -> ready");
                        networkSendOperatorReady();
                    }
                    break;
                case InputEvent::LONG_NO:
                    Serial.println("Operator: long NO -> clear");
                    networkSendOperatorClear();
                    break;
                case InputEvent::NONE:
                default:
                    break;
            }
        } else {
            bool hasActiveEvent = currentDisplay.leds.yes == LedState::BRIGHT ||
                                  currentDisplay.statusLed == GameLedState::VOTING ||
                                  currentDisplay.statusLed == GameLedState::LOCKED ||
                                  currentDisplay.statusLed == GameLedState::ABSTAINED;
            bool isIdle = !hasActiveEvent &&
                          currentDisplay.statusLed != GameLedState::LOBBY &&
                          currentDisplay.statusLed != GameLedState::GAME_OVER &&
                          currentDisplay.statusLed != GameLedState::DEAD;

            switch (event) {
                case InputEvent::UP:
                    isIdle ? networkSendIdleScrollUp() : networkSendSelectUp();
                    break;
                case InputEvent::DOWN:
                    isIdle ? networkSendIdleScrollDown() : networkSendSelectDown();
                    break;
                case InputEvent::YES:
                    if (isIdle && currentDisplay.leds.yes == LedState::DIM) {
                        uint8_t idx = currentDisplay.idleScrollIndex;
                        if (idx > 0 && idx <= 2) {
                            networkSendUseItem(currentDisplay.icons[idx].id.c_str());
                        }
                    } else {
                        networkSendConfirm();
                    }
                    break;
                case InputEvent::NO:
                    networkSendAbstain();
                    break;
                case InputEvent::NONE:
                default:
                    break;
            }
        }

        if (displayDirty) {
            displayRender(currentDisplay);
            displayDirty = false;
        }
    }
    else if (connState == ConnectionState::ERROR) {
        static unsigned long lastRetryTime = 0;
        unsigned long now = millis();
        if (now - lastRetryTime >= WS_RECONNECT_MS) {
            lastRetryTime = now;
            Serial.println("Auto-retrying join...");
            networkRetryJoin();
        }
        InputEvent event = inputPoll();
        if (event == InputEvent::YES || event == InputEvent::NO) {
            Serial.println("Manual retry join...");
            networkRetryJoin();
        }
    }

    if (networkOtaRequested()) {
        networkExecuteOta();
    }

    delay(1);
}
