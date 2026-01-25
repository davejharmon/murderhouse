// Input Handler for Buttons and Rotary Encoder
#ifndef INPUT_H
#define INPUT_H

#include <Arduino.h>
#include "protocol.h"

// Initialize input pins
void inputInit();

// Poll for input events
// Call this frequently in the main loop
// Returns the next input event (or NONE if no event)
InputEvent inputPoll();

// Get the current encoder position (1-8 range, wrapping)
uint8_t inputGetRotaryPosition();

#endif // INPUT_H
