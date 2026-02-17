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

// Current display state (updated by network callback)
static DisplayState currentDisplay;
static bool displayDirty = true;

// Connection state tracking
static ConnectionState lastConnState = ConnectionState::BOOT;

// Player selection state (before connecting)
static uint8_t selectedPlayer = 1;  // 1-9
static bool playerSelectDirty = true;
static bool playerConfirmed = false;

// Reset detection state (hold encoder button for 3 seconds)
static unsigned long encoderBtnHeldSince = 0;
static bool resetMessageShown = false;
static const unsigned long RESET_HOLD_MS = 3000;      // Time to hold before showing message
static const unsigned long RESET_CONFIRM_MS = 2000;   // Additional time before restart

// Check for reset gesture (hold encoder button for 3+2 seconds)
// Returns true if reset is triggered (caller should not continue normal loop)
bool checkResetGesture() {
    unsigned long now = millis();

    // Encoder button is active LOW (pullup)
    if (digitalRead(PIN_ENCODER_SW) == LOW) {
        // Start tracking if not already
        if (encoderBtnHeldSince == 0) {
            encoderBtnHeldSince = now;
            resetMessageShown = false;
            Serial.println("Encoder button held - reset timer started");
        }

        unsigned long heldFor = now - encoderBtnHeldSince;

        // After 3 seconds, show restart message
        if (heldFor >= RESET_HOLD_MS && !resetMessageShown) {
            Serial.println("Showing restart message...");
            displayMessage("HOLD TO CONFIRM", "RESTARTING", "Release to cancel");
            ledsSetYes(LedState::BRIGHT);
            ledsSetNo(LedState::BRIGHT);
            resetMessageShown = true;
        }

        // After 5 seconds total (3 + 2), perform restart
        if (heldFor >= RESET_HOLD_MS + RESET_CONFIRM_MS) {
            Serial.println("Restarting terminal...");
            displayMessage("", "RESTARTING...", "");
            delay(500);  // Brief delay to show message
            ESP.restart();
        }

        return resetMessageShown;  // Block normal input while showing reset message
    } else {
        // Button released - cancel reset
        if (encoderBtnHeldSince != 0) {
            if (resetMessageShown) {
                Serial.println("Reset cancelled");
                // Restore display based on current state
                if (!playerConfirmed) {
                    displayPlayerSelect(selectedPlayer);
                } else {
                    displayDirty = true;  // Force display refresh
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
    currentDisplay = state;
    displayDirty = true;

    // Update button LEDs from display state
    ledsSetFromDisplay(state);

    // Update neopixel from game state
    ledsSetGameState(state.statusLed);
}

void setup() {
    // Initialize serial for debugging
    Serial.begin(115200);
    Serial.println();
    Serial.println("=== Murderhouse ESP32 Terminal ===");

    // Initialize subsystems
    Serial.println("Initializing display...");
    displayInit();
    displayConnectionStatus(ConnectionState::BOOT);

    Serial.println("Initializing LEDs...");
    ledsInit();
    ledsSetStatus(ConnectionState::BOOT);

    // Brief LED test at boot
    Serial.println("Testing button LEDs...");
    ledsSetYes(LedState::BRIGHT);
    ledsSetNo(LedState::BRIGHT);
    delay(500);
    ledsSetYes(LedState::OFF);
    ledsSetNo(LedState::OFF);

    Serial.println("Initializing heart rate monitor...");
    heartrateInit();

    // Brief heartbeat LED test at boot
    Serial.println("Testing heartbeat LED (D3)...");
    digitalWrite(PIN_LED_HEARTBEAT, HIGH);
    delay(500);
    digitalWrite(PIN_LED_HEARTBEAT, LOW);

    Serial.println("Initializing input...");
    inputInit();

    // Start in player selection mode
    Serial.println("Entering player selection...");
    lastConnState = ConnectionState::PLAYER_SELECT;
    ledsSetStatus(ConnectionState::PLAYER_SELECT);
    ledsSetYes(LedState::BRIGHT);  // Light YES button to indicate it confirms
    displayPlayerSelect(selectedPlayer);
    playerSelectDirty = false;

    Serial.println("Use dial to select player (1-9), press YES to confirm");
}

void loop() {
    // Update LEDs (for pulse animations)
    ledsUpdate();

    // Update heart rate monitor (sampling + LED control)
    heartrateUpdate();

    // Check for reset gesture (hold both buttons for 3 seconds)
    if (checkResetGesture()) {
        delay(10);
        return;  // Skip normal processing while reset is pending
    }

    // Handle player selection mode (before network is initialized)
    if (!playerConfirmed) {
        // Poll for input events
        InputEvent event = inputPoll();

        switch (event) {
            case InputEvent::UP:
                // Move selection up (wrap from 1 to 9)
                if (selectedPlayer == 1) {
                    selectedPlayer = 9;
                } else {
                    selectedPlayer--;
                }
                playerSelectDirty = true;
                Serial.print("Selected player: ");
                Serial.println(selectedPlayer);
                break;

            case InputEvent::DOWN:
                // Move selection down (wrap from 9 to 1)
                if (selectedPlayer == 9) {
                    selectedPlayer = 1;
                } else {
                    selectedPlayer++;
                }
                playerSelectDirty = true;
                Serial.print("Selected player: ");
                Serial.println(selectedPlayer);
                break;

            case InputEvent::YES:
                // Confirm selection and start connecting
                Serial.print("Player confirmed: ");
                Serial.println(selectedPlayer);
                playerConfirmed = true;

                // Set the player ID
                networkSetPlayerId(selectedPlayer);

                // Turn off YES button pulse
                ledsSetYes(LedState::OFF);

                // Initialize network (this will start WiFi connection)
                Serial.println("Initializing network...");
                networkInit();
                networkSetDisplayCallback(onDisplayUpdate);
                break;

            case InputEvent::NO:
            case InputEvent::NONE:
            default:
                break;
        }

        // Update display if selection changed
        if (playerSelectDirty) {
            displayPlayerSelect(selectedPlayer);
            playerSelectDirty = false;
        }

        delay(1);
        return;  // Don't process network until player is confirmed
    }

    // Update network and get connection state
    ConnectionState connState = networkUpdate();

    // Handle connection state changes
    if (connState != lastConnState) {
        lastConnState = connState;

        // Update status LED
        ledsSetStatus(connState);

        // Update display for connection states
        if (connState != ConnectionState::CONNECTED) {
            // Pass error message for ERROR state
            const char* detail = nullptr;
            if (connState == ConnectionState::ERROR) {
                detail = networkGetLastError();
            }
            displayConnectionStatus(connState, detail);
        }

        Serial.print("Connection state: ");
        switch (connState) {
            case ConnectionState::BOOT:
                Serial.println("BOOT");
                break;
            case ConnectionState::PLAYER_SELECT:
                Serial.println("PLAYER_SELECT");
                break;
            case ConnectionState::WIFI_CONNECTING:
                Serial.println("WIFI_CONNECTING");
                break;
            case ConnectionState::WS_CONNECTING:
                Serial.println("WS_CONNECTING");
                break;
            case ConnectionState::JOINING:
                Serial.println("JOINING");
                break;
            case ConnectionState::CONNECTED:
                Serial.println("CONNECTED");
                break;
            case ConnectionState::RECONNECTING:
                Serial.println("RECONNECTING");
                break;
            case ConnectionState::ERROR:
                Serial.print("ERROR: ");
                Serial.println(networkGetLastError());
                break;
        }
    }

    // Handle input based on connection state
    if (networkIsConnected()) {
        // Poll for input events
        InputEvent event = inputPoll();

        // Determine if player is idle (no pending events shown - inferred from display state)
        // When idle, server sends leds.yes as OFF or DIM (for items), and display has no event info
        // We use the idleScrollIndex and icon data to decide routing
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
                Serial.println("Input: UP");
                if (isIdle) {
                    networkSendIdleScrollUp();
                } else {
                    networkSendSelectUp();
                }
                break;

            case InputEvent::DOWN:
                Serial.println("Input: DOWN");
                if (isIdle) {
                    networkSendIdleScrollDown();
                } else {
                    networkSendSelectDown();
                }
                break;

            case InputEvent::YES:
                Serial.println("Input: YES");
                if (isIdle && currentDisplay.leds.yes == LedState::DIM) {
                    // On a usable item slot - send useItem
                    // The item ID comes from the icon at the current scroll index
                    uint8_t idx = currentDisplay.idleScrollIndex;
                    if (idx > 0 && idx <= 2) {
                        const char* itemId = currentDisplay.icons[idx].id.c_str();
                        networkSendUseItem(itemId);
                    }
                } else {
                    networkSendConfirm();
                }
                break;

            case InputEvent::NO:
                Serial.println("Input: NO");
                networkSendAbstain();
                break;

            case InputEvent::NONE:
            default:
                break;
        }

        // Update display if dirty
        if (displayDirty) {
            displayRender(currentDisplay);
            displayDirty = false;
        }
    }
    else if (connState == ConnectionState::ERROR) {
        // In error state, any button press retries the join
        InputEvent event = inputPoll();
        if (event == InputEvent::YES || event == InputEvent::NO) {
            Serial.println("Retrying join...");
            networkRetryJoin();
        }
    }

    // Small delay to prevent tight looping
    delay(1);
}
