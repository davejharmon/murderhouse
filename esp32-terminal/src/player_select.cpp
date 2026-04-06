// Player selection implementation
#include "player_select.h"
#include "config.h"
#include "input.h"
#include "leds.h"
#include "network.h"

static uint8_t selectedPlayer = 1;  // 1-9 or 0 for OPERATOR
static bool confirmed = false;
static bool dirty = true;

void psInit() {
    selectedPlayer = 1;
    confirmed = false;
    dirty = true;
}

bool psIsConfirmed() { return confirmed; }
uint8_t psGetSelectedPlayer() { return selectedPlayer; }
bool psIsDirty() { return dirty; }
void psClearDirty() { dirty = false; }
void psMarkDirty() { dirty = true; }

void psReset() {
    confirmed = false;
    dirty = true;
}

bool psHandleInput() {
    if (confirmed) return false;

    InputEvent event = inputPoll();

    switch (event) {
        case InputEvent::UP:
            if (selectedPlayer == 1) selectedPlayer = 0;
            else if (selectedPlayer == 0) selectedPlayer = 9;
            else selectedPlayer--;
            dirty = true;
            if (selectedPlayer == 0) Serial.println("Selected: OPERATOR");
            else { Serial.print("Selected player: "); Serial.println(selectedPlayer); }
            break;

        case InputEvent::DOWN:
            if (selectedPlayer == 9) selectedPlayer = 0;
            else if (selectedPlayer == 0) selectedPlayer = 1;
            else selectedPlayer++;
            dirty = true;
            if (selectedPlayer == 0) Serial.println("Selected: OPERATOR");
            else { Serial.print("Selected player: "); Serial.println(selectedPlayer); }
            break;

        case InputEvent::YES:
            confirmed = true;
            ledsSetYes(LedState::OFF);
            Serial.println("Initializing network...");
            if (selectedPlayer == 0) {
                Serial.println("Confirmed: OPERATOR");
                networkSetOperatorMode();
            } else {
                Serial.print("Confirmed player: ");
                Serial.println(selectedPlayer);
                networkSetPlayerId(selectedPlayer);
            }
            networkInit();
            break;

        case InputEvent::NO:
        case InputEvent::NONE:
        default:
            break;
    }

    return !confirmed;
}
