// AD8232 Heart Rate Monitor — leads detection, beat detection, panel LED control
#ifndef HEARTRATE_H
#define HEARTRATE_H

#include <Arduino.h>

// Initialize AD8232 pins and panel LEDs
void heartrateInit();

// Sample ADC, detect beats, drive LEDs (call every loop iteration)
void heartrateUpdate();

// Get current BPM (average of recent beat intervals, 0 if insufficient data)
uint8_t heartrateGetBPM();

// Returns true if a beat was detected within the last 3 seconds
bool heartrateIsActive();

#endif // HEARTRATE_H
