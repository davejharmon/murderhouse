// Network Layer for WiFi and WebSocket Communication
#ifndef NETWORK_H
#define NETWORK_H

#include <Arduino.h>
#include "protocol.h"

// Callback type for receiving display state updates
typedef void (*DisplayStateCallback)(const DisplayState& state);

// Set the player ID to use for joining (call before networkInit)
// playerNum should be 1-9
void networkSetPlayerId(uint8_t playerNum);

// Initialize network (WiFi credentials from config.h)
void networkInit();

// Set the callback for display state updates
void networkSetDisplayCallback(DisplayStateCallback callback);

// Update network (call in main loop)
// Returns the current connection state
ConnectionState networkUpdate();

// Check if connected to game server
bool networkIsConnected();

// Retry joining after an error
void networkRetryJoin();

// Send messages to server
void networkSendSelectUp();
void networkSendSelectDown();
void networkSendConfirm();
void networkSendAbstain();
void networkSendUseItem(const char* itemId);
void networkSendIdleScrollUp();
void networkSendIdleScrollDown();

// Get last error message (if any)
const char* networkGetLastError();

#endif // NETWORK_H
