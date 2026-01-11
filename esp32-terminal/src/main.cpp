// ESP32 Physical Terminal for Murderhouse
// Main Application Entry Point

#include <Arduino.h>
#include "config.h"
#include "protocol.h"
#include "display.h"
#include "input.h"
#include "leds.h"
#include "network.h"

// Current display state (updated by network callback)
static DisplayState currentDisplay;
static bool displayDirty = true;

// Connection state tracking
static ConnectionState lastConnState = ConnectionState::BOOT;

// Callback when display state is received from server
void onDisplayUpdate(const DisplayState& state) {
    currentDisplay = state;
    displayDirty = true;

    // Update button LEDs from display state
    ledsSetFromDisplay(state);
}

void setup() {
    // Initialize serial for debugging
    Serial.begin(115200);
    Serial.println();
    Serial.println("=== Murderhouse ESP32 Terminal ===");
    Serial.print("Player ID: ");
    Serial.println(PLAYER_ID);

    // Initialize subsystems
    Serial.println("Initializing display...");
    displayInit();
    displayConnectionStatus(ConnectionState::BOOT);

    Serial.println("Initializing LEDs...");
    ledsInit();
    ledsSetStatus(ConnectionState::BOOT);

    Serial.println("Initializing input...");
    inputInit();

    Serial.println("Initializing network...");
    networkInit();
    networkSetDisplayCallback(onDisplayUpdate);

    Serial.println("Initialization complete!");
}

void loop() {
    // Update LEDs (for pulse animations)
    ledsUpdate();

    // Update network and get connection state
    ConnectionState connState = networkUpdate();

    // Handle connection state changes
    if (connState != lastConnState) {
        lastConnState = connState;

        // Update status LED
        ledsSetStatus(connState);

        // Update display for connection states
        if (connState != ConnectionState::CONNECTED) {
            displayConnectionStatus(connState);
        }

        Serial.print("Connection state: ");
        switch (connState) {
            case ConnectionState::BOOT:
                Serial.println("BOOT");
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
        }
    }

    // Only process game input when connected
    if (networkIsConnected()) {
        // Poll for input events
        InputEvent event = inputPoll();

        switch (event) {
            case InputEvent::UP:
                Serial.println("Input: UP");
                networkSendSelectUp();
                break;

            case InputEvent::DOWN:
                Serial.println("Input: DOWN");
                networkSendSelectDown();
                break;

            case InputEvent::YES:
                Serial.println("Input: YES");
                // YES can be confirm or useItem depending on state
                // For now, just send confirm - server will handle appropriately
                networkSendConfirm();
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

    // Small delay to prevent tight looping
    delay(1);
}
