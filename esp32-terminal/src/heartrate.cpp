// AD8232 Heart Rate Monitor — beat detection and red panel LED control

#include "heartrate.h"
#include "config.h"

// BPM send callback — set by caller to avoid heartrate.cpp depending on network.cpp
typedef void (*BpmSendCallback)(uint8_t bpm);
static BpmSendCallback bpmSendCallback = nullptr;
static unsigned long lastBpmSend = 0;
static bool lastBpmActive = false;
static const unsigned long BPM_SEND_INTERVAL_MS = 2000;

// AD8232 power state — powered on once connected to keep analog circuit warm
static bool hrPowered = false;

// Reporting/LED state — controlled by server via heartrateMonitor message
static bool hrEnabled = false;

// Beat detection state
static unsigned long lastSampleTime = 0;
static unsigned long lastBeatTime = 0;
static unsigned long beatLedOnTime = 0;
static bool beatLedOn = false;

// BPM calculation — circular buffer of last 4 beat intervals
static const int BPM_BUFFER_SIZE = 6;
static unsigned long beatIntervals[6] = {0};
static int beatIntervalIndex = 0;
static int beatIntervalCount = 0;
static unsigned long prevBeatTime = 0;

static const unsigned long ACTIVE_TIMEOUT_MS = 3000; // Consider inactive after 3s without a beat

// Adaptive threshold — sliding window min/max
static const unsigned long WINDOW_MS = 2000;     // 2-second rolling window
static const unsigned long REFRACTORY_MS = 400;   // ~150 BPM cap
static const float THRESHOLD_RATIO = 0.60f;       // 60% of range above min
static const int MIN_RANGE = 400;                  // Minimum ADC range to reject T-wave false triggers

static int rollingMin = 4095;
static int rollingMax = 0;
static unsigned long windowStart = 0;

// Track whether signal was below threshold (for rising-edge detection)
static bool wasBelowThreshold = true;

void heartrateInit() {
    // AD8232 shutdown control — start in shutdown (HIGH = off)
    pinMode(PIN_AD8232_SDN, OUTPUT);
    digitalWrite(PIN_AD8232_SDN, HIGH);
    hrPowered = false;
    hrEnabled = false;

    // Red heartbeat LED
    pinMode(PIN_LED_HEARTBEAT, OUTPUT);
    digitalWrite(PIN_LED_HEARTBEAT, LOW);

    Serial.println("[HR] AD8232 initialized, SDN HIGH (shutdown)");
}

void heartratePowerOn() {
    if (!hrPowered) {
        digitalWrite(PIN_AD8232_SDN, LOW);
        hrPowered = true;
        Serial.println("[HR] AD8232 powered on (warm-up)");
    }
}

void heartratePowerOff() {
    if (hrPowered) {
        digitalWrite(PIN_AD8232_SDN, HIGH);
        digitalWrite(PIN_LED_HEARTBEAT, LOW);
        beatLedOn = false;
        hrPowered = false;
        hrEnabled = false;
        Serial.println("[HR] AD8232 powered off");
    }
}

void heartrateEnable() {
    if (!hrEnabled) {
        heartratePowerOn(); // Ensure powered on
        hrEnabled = true;
        Serial.println("[HR] Reporting enabled");
    }
}

void heartrateDisable() {
    if (hrEnabled) {
        digitalWrite(PIN_LED_HEARTBEAT, LOW);
        beatLedOn = false;
        hrEnabled = false;
        Serial.println("[HR] Reporting disabled");
    }
}

void heartrateUpdate() {
    if (!hrPowered) return;

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
            // Beat detected — record interval for BPM
            if (prevBeatTime > 0) {
                unsigned long interval = now - prevBeatTime;
                if (interval > 300 && interval < 4000) {
                    while (interval > 1500) interval /= 2;
                    beatIntervals[beatIntervalIndex] = interval;
                    beatIntervalIndex = (beatIntervalIndex + 1) % BPM_BUFFER_SIZE;
                    if (beatIntervalCount < BPM_BUFFER_SIZE) beatIntervalCount++;
                }
            }
            prevBeatTime = now;

            lastBeatTime = now;

            // Only flash LED when reporting is enabled
            if (hrEnabled) {
                Serial.printf("[HR] Beat detected  sample=%d  threshold=%d  range=%d\n", sample, threshold, range);
                digitalWrite(PIN_LED_HEARTBEAT, HIGH);
                beatLedOn = true;
                beatLedOnTime = now;
            }
        }
        wasBelowThreshold = false;
    } else {
        wasBelowThreshold = true;
    }
}

uint8_t heartrateGetBPM() {
    if (beatIntervalCount == 0) return 0;

    unsigned long sum = 0;
    int count = min(beatIntervalCount, BPM_BUFFER_SIZE);
    for (int i = 0; i < count; i++) {
        sum += beatIntervals[i];
    }
    unsigned long avgInterval = sum / count;
    if (avgInterval == 0) return 0;

    unsigned long bpm = 60000 / avgInterval;
    if (bpm > 220) bpm = 220;
    return (uint8_t)bpm;
}

bool heartrateIsActive() {
    return (lastBeatTime > 0) && (millis() - lastBeatTime < ACTIVE_TIMEOUT_MS);
}

void heartrateSetSendCallback(void (*cb)(uint8_t)) {
    bpmSendCallback = cb;
}

// Call each loop iteration when connected. Sends BPM every 2 s; sends 0 once when signal lost.
void heartrateCheckAndSend() {
    if (!bpmSendCallback) return;
    unsigned long now = millis();
    bool active = heartrateIsActive();
    if (active && (now - lastBpmSend >= BPM_SEND_INTERVAL_MS)) {
        bpmSendCallback(heartrateGetBPM());
        lastBpmSend = now;
        lastBpmActive = true;
    } else if (!active && lastBpmActive) {
        bpmSendCallback(0);  // One final send to clear server-side BPM
        lastBpmActive = false;
    }
}
