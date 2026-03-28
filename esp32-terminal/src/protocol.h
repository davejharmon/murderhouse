// WebSocket Protocol Constants
// Mirrors shared/constants.js from the game server
#ifndef PROTOCOL_H
#define PROTOCOL_H

#include <Arduino.h>

// ============================================================================
// SERVER -> CLIENT MESSAGE TYPES
// ============================================================================

namespace ServerMsg {
    const char* const WELCOME = "welcome";
    const char* const ERROR = "error";
    const char* const GAME_STATE = "gameState";
    const char* const PLAYER_STATE = "playerState";
    const char* const PLAYER_LIST = "playerList";
    const char* const EVENT_PROMPT = "eventPrompt";
    const char* const EVENT_RESULT = "eventResult";
    const char* const PHASE_CHANGE = "phaseChange";
    const char* const OPERATOR_STATE = "operatorState";
    const char* const HEARTRATE_MONITOR = "heartrateMonitor";
    const char* const UPDATE_FIRMWARE = "updateFirmware";
    const char* const KICKED = "kicked";
}

// ============================================================================
// CLIENT -> SERVER MESSAGE TYPES
// ============================================================================

namespace ClientMsg {
    const char* const JOIN = "join";
    const char* const REJOIN = "rejoin";
    const char* const SELECT_UP = "selectUp";
    const char* const SELECT_DOWN = "selectDown";
    const char* const SELECT_TO = "selectTo";
    const char* const CONFIRM = "confirm";
    const char* const ABSTAIN = "abstain";
    const char* const USE_ITEM = "useItem";
    const char* const IDLE_SCROLL_UP = "idleScrollUp";
    const char* const IDLE_SCROLL_DOWN = "idleScrollDown";
    const char* const HEARTBEAT = "heartbeat";
    const char* const OPERATOR_JOIN = "operatorJoin";
    const char* const OPERATOR_ADD = "operatorAdd";
    const char* const OPERATOR_DELETE = "operatorDelete";
    const char* const OPERATOR_READY = "operatorReady";
    const char* const OPERATOR_UNREADY = "operatorUnready";
    const char* const OPERATOR_CLEAR   = "operatorClear";
}

// ============================================================================
// LED STATES
// ============================================================================

enum class LedState {
    OFF,
    DIM,
    BRIGHT,
    PULSE
};

// Parse LED state from string
inline LedState parseLedState(const String& state) {
    if (state == "dim") return LedState::DIM;
    if (state == "bright") return LedState::BRIGHT;
    if (state == "pulse") return LedState::PULSE;
    return LedState::OFF;
}

// ============================================================================
// DISPLAY STYLES
// ============================================================================

enum class DisplayStyle {
    NORMAL,
    LOCKED,
    ABSTAINED,
    WAITING,
    CRITICAL,
    OPERATOR   // Operator sentence mode: full 3-line sentence in FONT_SMALL
};

// Parse display style from string
inline DisplayStyle parseDisplayStyle(const String& style) {
    if (style == "locked") return DisplayStyle::LOCKED;
    if (style == "abstained") return DisplayStyle::ABSTAINED;
    if (style == "waiting") return DisplayStyle::WAITING;
    if (style == "critical") return DisplayStyle::CRITICAL;
    if (style == "operator") return DisplayStyle::OPERATOR;
    return DisplayStyle::NORMAL;
}

// ============================================================================
// GAME STATUS LED STATES (neopixel during gameplay)
// ============================================================================

enum class GameLedState {
    NONE,       // No game state (use connection colour)
    OFF,        // Explicitly turn off neopixel
    LOBBY,
    DAY,
    NIGHT,
    VOTING,
    LOCKED,
    ABSTAINED,
    DEAD,
    GAME_OVER
};

// Parse game LED state from string
inline GameLedState parseGameLedState(const String& state) {
    if (state == "off") return GameLedState::OFF;
    if (state == "lobby") return GameLedState::LOBBY;
    if (state == "day") return GameLedState::DAY;
    if (state == "night") return GameLedState::NIGHT;
    if (state == "voting") return GameLedState::VOTING;
    if (state == "locked") return GameLedState::LOCKED;
    if (state == "abstained") return GameLedState::ABSTAINED;
    if (state == "dead") return GameLedState::DEAD;
    if (state == "gameOver") return GameLedState::GAME_OVER;
    return GameLedState::NONE;
}

// ============================================================================
// CONNECTION STATES
// ============================================================================

enum class ConnectionState {
    BOOT,
    PLAYER_SELECT,   // Selecting player ID (1-9) or OPERATOR before connecting
    WIFI_CONNECTING,
    DISCOVERING,     // Broadcasting UDP to find server
    WS_CONNECTING,
    JOINING,
    CONNECTED,
    RECONNECTING,
    ERROR
};

// ============================================================================
// INPUT EVENTS
// ============================================================================

enum class InputEvent {
    NONE,
    UP,
    DOWN,
    YES,
    NO,
    LONG_YES,   // YES held >= LONG_PRESS_MS
    LONG_NO     // NO held >= LONG_PRESS_MS
};

// ============================================================================
// ICON COLUMN
// ============================================================================

enum class IconState {
    ACTIVE,
    INACTIVE,
    EMPTY
};

inline IconState parseIconState(const String& state) {
    if (state == "active") return IconState::ACTIVE;
    if (state == "inactive") return IconState::INACTIVE;
    return IconState::EMPTY;
}

struct IconSlot {
    String id;
    IconState state;
    IconSlot() : id("empty"), state(IconState::EMPTY) {}
};

// ============================================================================
// DISPLAY STATE STRUCTURE
// ============================================================================

struct DisplayState {
    // Line 1: Context info
    struct {
        String left;   // e.g., "DAY 1", "ALPHA > VOTE"
        String right;  // e.g., ":wolf:", ":lock:"
    } line1;

    // Line 2: Main content
    struct {
        String text;         // e.g., "PLAYER 3", "ABSTAINED"
        DisplayStyle style;  // Visual style variant
    } line2;

    // Line 3: Tutorial/tip (supports centered text, left/right, and left/center/right)
    struct {
        String text;   // Centered text (used if left/right empty)
        String left;   // Left-aligned (above YES button)
        String center; // Center-aligned (e.g., pack hint)
        String right;  // Right-aligned (above NO button)
    } line3;

    // LED states
    struct {
        LedState yes;
        LedState no;
    } leds;

    // Status LED (neopixel game state)
    GameLedState statusLed;

    // Icon column (3 slots)
    IconSlot icons[3];
    uint8_t idleScrollIndex;

    // Target list for local scrolling during event target selection.
    // Populated by server when player is in target-selection state; empty otherwise.
    // Allows ESP32 to predict scroll locally (instant display) while rate-limiting server sends.
    // targetIds are used in CONFIRM so the server lands on the right target regardless of
    // how many throttled SELECT messages it received.
    static const int MAX_TARGETS = 10;
    String targetIds[MAX_TARGETS];    // player IDs — sent in CONFIRM for accuracy
    String targetNames[MAX_TARGETS];  // display names — used for local rendering
    int    targetCount;
    int    selectionIndex;  // -1 = no selection

    // Default constructor
    DisplayState() {
        line1.left = "CONNECTING";
        line1.right = "";
        line2.text = "...";
        line2.style = DisplayStyle::NORMAL;
        line3.text = "Please wait";
        leds.yes = LedState::OFF;
        leds.no = LedState::OFF;
        statusLed = GameLedState::NONE;
        idleScrollIndex = 0;
        targetCount = 0;
        selectionIndex = -1;
    }
};


#endif // PROTOCOL_H
