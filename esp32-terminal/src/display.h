// Display Driver for SSD1322 256x64 OLED
#ifndef DISPLAY_H
#define DISPLAY_H

#include <Arduino.h>
#include "protocol.h"

// Initialize the display
void displayInit();

// Render the current display state
void displayRender(const DisplayState& state);

// Show a simple message (for boot/connection states)
void displayMessage(const char* line1, const char* line2, const char* line3);

// Show connection status
void displayConnectionStatus(ConnectionState state, const char* detail = nullptr);

// Show player selection screen (1-9)
void displayPlayerSelect(uint8_t selectedPlayer);

// Clear the display
void displayClear();

#endif // DISPLAY_H
