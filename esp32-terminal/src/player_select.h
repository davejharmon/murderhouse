// Player selection state and input handling (pre-network phase)
// Manages the dial-to-select-player-number / OPERATOR screen shown at boot.
#ifndef PLAYER_SELECT_H
#define PLAYER_SELECT_H

#include <Arduino.h>

// Initialize to default state (player 1, unconfirmed)
void psInit();

// Handle input events for the selection screen.
// Returns true while still in select mode; false once confirmed.
// Calls networkSetPlayerId / networkSetOperatorMode + networkInit when confirmed — caller
// must follow up with networkSetDisplayCallback(onDisplayUpdate).
bool psHandleInput();

// Returns true after player has confirmed their selection
bool psIsConfirmed();

// Returns selected player number (0 = OPERATOR, 1-9 = player)
uint8_t psGetSelectedPlayer();

// Returns true if the display needs to be redrawn after an input change
bool psIsDirty();

// Clear dirty flag after the display has been updated
void psClearDirty();

// Mark display as needing refresh (e.g. after screen mode toggle)
void psMarkDirty();

// Reset to unconfirmed state (call on kick)
void psReset();

#endif // PLAYER_SELECT_H
