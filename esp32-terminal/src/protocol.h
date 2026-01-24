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
// CONNECTION STATES
// ============================================================================

enum class ConnectionState {
    BOOT,
    PLAYER_SELECT,   // Selecting player ID (1-9) before connecting
    WIFI_CONNECTING,
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

    // Line 3: Tutorial/tip
    struct {
        String text;  // e.g., "YES confirm - NO abstain"
    } line3;

    // LED states
    struct {
        LedState yes;
        LedState no;
    } leds;

    // Default constructor
    DisplayState() {
        line1.left = "CONNECTING";
        line1.right = "";
        line2.text = "...";
        line2.style = DisplayStyle::NORMAL;
        line3.text = "Please wait";
        leds.yes = LedState::OFF;
        leds.no = LedState::OFF;
    }
};

// ============================================================================
// GLYPH MAPPING
// ============================================================================

// Glyph tokens and their display characters
// For bitmap support, these could be replaced with custom character codes
struct GlyphEntry {
    const char* token;
    char display;
};

const GlyphEntry GLYPHS[] = {
    {":pistol:", '*'},
    {":phone:", '$'},
    {":crystal:", '@'},
    {":wolf:", 'W'},
    {":village:", 'V'},
    {":lock:", '!'},
    {":check:", '+'},
    {":x:", '-'},
    {":alpha:", 'A'},
    {":pack:", 'P'},
    {":skull:", 'X'},
    {nullptr, 0}  // Sentinel
};

// Replace glyph tokens in a string with display characters
inline String renderGlyphs(const String& input) {
    String result = input;
    for (int i = 0; GLYPHS[i].token != nullptr; i++) {
        result.replace(GLYPHS[i].token, String(GLYPHS[i].display));
    }
    return result;
}

#endif // PROTOCOL_H
