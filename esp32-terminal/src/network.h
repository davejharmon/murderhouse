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

// Set operator mode (connect as operator terminal instead of player)
void networkSetOperatorMode();

// Check if running as operator terminal
bool networkIsOperatorMode();

// Check if operator is in ready state
bool networkIsOperatorReady();

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
void networkSendSelectTo(const char* targetId);  // Settle update — sets server selection by ID
void networkSendConfirm();
void networkSendConfirmWithTarget(const char* targetId);  // Explicit target — bypasses stale server selection
void networkSendAbstain();
void networkSendUseItem(const char* itemId);
void networkSendIdleScrollUp();
void networkSendIdleScrollDown();
void networkSendHeartbeat(uint8_t bpm);

// Operator terminal messages
void networkOperatorTick();       // Call each loop; clears SENT! screen after 2s
void networkOperatorScrollUp();
void networkOperatorScrollDown();
void networkSendOperatorAdd();
void networkSendOperatorReady();
void networkSendOperatorUnready();
void networkSendOperatorDelete();
void networkSendOperatorClear();

// Get last error message (if any)
const char* networkGetLastError();

// Check if an OTA update was requested by the server; execute from main loop
bool networkOtaRequested();
void networkExecuteOta();

#endif // NETWORK_H
