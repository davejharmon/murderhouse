// LED Controller for Button LEDs and Neopixel Status
#ifndef LEDS_H
#define LEDS_H

#include <Arduino.h>
#include "protocol.h"

// Initialize LEDs
void ledsInit();

// Update LEDs (call in main loop for pulse animations)
void ledsUpdate();

// Set button LED states
void ledsSetYes(LedState state);
void ledsSetNo(LedState state);

// Set both button LEDs from display state
void ledsSetFromDisplay(const DisplayState& state);

// Set neopixel status color
void ledsSetStatus(ConnectionState state);

// Set neopixel to a custom color
void ledsSetStatusColor(uint8_t r, uint8_t g, uint8_t b);

// Set neopixel from game state (overrides connection status when in-game)
void ledsSetGameState(GameLedState state);

// Turn off all LEDs
void ledsOff();

#endif // LEDS_H
