// AD8232 Heart Rate Monitor — beat detection and red panel LED control

#include "heartrate.h"
#include "config.h"

// Beat detection state
static unsigned long lastSampleTime = 0;
static unsigned long lastBeatTime = 0;
static unsigned long beatLedOnTime = 0;
static bool beatLedOn = false;

// Adaptive threshold — sliding window min/max
static const unsigned long WINDOW_MS = 2000;     // 2-second rolling window
static const unsigned long REFRACTORY_MS = 300;   // ~200 BPM cap
static const float THRESHOLD_RATIO = 0.60f;       // 60% of range above min
static const int MIN_RANGE = 400;                  // Minimum ADC range to consider valid signal

static int rollingMin = 4095;
static int rollingMax = 0;
static unsigned long windowStart = 0;

// Track whether signal was below threshold (for rising-edge detection)
static bool wasBelowThreshold = true;

void heartrateInit() {
    // AD8232 shutdown control — drive LOW to enable
    pinMode(PIN_AD8232_SDN, OUTPUT);
    digitalWrite(PIN_AD8232_SDN, LOW);

    // Red heartbeat LED
    pinMode(PIN_LED_HEARTBEAT, OUTPUT);
    digitalWrite(PIN_LED_HEARTBEAT, LOW);

    Serial.println("[HR] AD8232 initialized, SDN LOW (active)");
}

void heartrateUpdate() {
    unsigned long now = millis();

    // Turn off beat LED after flash duration
    if (beatLedOn && (now - beatLedOnTime >= AD8232_BEAT_FLASH_MS)) {
        digitalWrite(PIN_LED_HEARTBEAT, LOW);
        beatLedOn = false;
    }

    // Sample at ~250 Hz
    if (now - lastSampleTime < AD8232_SAMPLE_MS) return;
    lastSampleTime = now;

    // Read analog signal
    int sample = analogRead(PIN_AD8232_OUT);

    // Update rolling min/max window
    if (now - windowStart > WINDOW_MS) {
        // Decay toward current sample to avoid stale extremes
        rollingMin = sample;
        rollingMax = sample;
        windowStart = now;
    } else {
        if (sample < rollingMin) rollingMin = sample;
        if (sample > rollingMax) rollingMax = sample;
    }

    int range = rollingMax - rollingMin;

    if (range < MIN_RANGE) return;  // Signal too weak or just noise, skip detection

    // Dynamic threshold
    int threshold = rollingMin + (int)(range * THRESHOLD_RATIO);

    if (sample >= threshold) {
        if (wasBelowThreshold && (now - lastBeatTime >= REFRACTORY_MS)) {
            // Beat detected
            Serial.printf("[HR] Beat detected  sample=%d  threshold=%d  range=%d\n", sample, threshold, range);
            lastBeatTime = now;
            digitalWrite(PIN_LED_HEARTBEAT, HIGH);
            beatLedOn = true;
            beatLedOnTime = now;
        }
        wasBelowThreshold = false;
    } else {
        wasBelowThreshold = true;
    }
}
