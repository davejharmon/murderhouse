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
}

// ============================================================================
// CLIENT -> SERVER MESSAGE TYPES
// ============================================================================

namespace ClientMsg {
    const char* const JOIN = "join";
    const char* const REJOIN = "rejoin";
    const char* const SELECT_UP = "selectUp";
    const char* const SELECT_DOWN = "selectDown";
    const char* const CONFIRM = "confirm";
    const char* const ABSTAIN = "abstain";
    const char* const USE_ITEM = "useItem";
    const char* const IDLE_SCROLL_UP = "idleScrollUp";
    const char* const IDLE_SCROLL_DOWN = "idleScrollDown";
    const char* const HEARTBEAT = "heartbeat";
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
    WAITING
};

// Parse display style from string
inline DisplayStyle parseDisplayStyle(const String& style) {
    if (style == "locked") return DisplayStyle::LOCKED;
    if (style == "abstained") return DisplayStyle::ABSTAINED;
    if (style == "waiting") return DisplayStyle::WAITING;
    return DisplayStyle::NORMAL;
}

// ============================================================================
// GAME STATUS LED STATES (neopixel during gameplay)
// ============================================================================

enum class GameLedState {
    NONE,       // No game state (use connection colour)
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
    PLAYER_SELECT,   // Selecting player ID (1-9) before connecting
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
    NO
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
    }
};


#endif // PROTOCOL_H
