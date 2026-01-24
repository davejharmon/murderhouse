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

// Placeholder character used for bitmap glyphs during text rendering
// This character takes up space but will be replaced with bitmap
#define GLYPH_PLACEHOLDER '\x01'

// Glyph types
enum class GlyphType {
    CHARACTER,  // Simple character replacement
    BITMAP      // Bitmap glyph (drawn separately)
};

// Bitmap glyph data (XBM format, LSB = leftmost pixel)
// 8x8 skull bitmap
const uint8_t BITMAP_SKULL[] = {
    0x3C,  // ..1111..
    0x42,  // .1....1.
    0x6D,  // .1.11.1.  (eye sockets)
    0x81,  // 1......1
    0x42,  // .1....1.
    0x3C,  // ..1111..
    0x18,  // ...11...  (nose)
    0x7E   // .111111.  (jaw)
};
const uint8_t BITMAP_SKULL_WIDTH = 8;
const uint8_t BITMAP_SKULL_HEIGHT = 8;

// Glyph entry with optional bitmap data
struct GlyphEntry {
    const char* token;
    GlyphType type;
    char display;           // Character to display (or placeholder width for bitmaps)
    const uint8_t* bitmap;  // Bitmap data (nullptr for character glyphs)
    uint8_t width;          // Bitmap width
    uint8_t height;         // Bitmap height
};

const GlyphEntry GLYPHS[] = {
    // Bitmap glyphs (will be rendered as actual graphics)
    {":skull:", GlyphType::BITMAP, ' ', BITMAP_SKULL, BITMAP_SKULL_WIDTH, BITMAP_SKULL_HEIGHT},

    // Character glyphs (simple text replacement)
    {":pistol:", GlyphType::CHARACTER, '*', nullptr, 0, 0},
    {":phone:", GlyphType::CHARACTER, '$', nullptr, 0, 0},
    {":crystal:", GlyphType::CHARACTER, '@', nullptr, 0, 0},
    {":wolf:", GlyphType::CHARACTER, 'W', nullptr, 0, 0},
    {":village:", GlyphType::CHARACTER, 'V', nullptr, 0, 0},
    {":lock:", GlyphType::CHARACTER, '!', nullptr, 0, 0},
    {":check:", GlyphType::CHARACTER, '+', nullptr, 0, 0},
    {":x:", GlyphType::CHARACTER, '-', nullptr, 0, 0},
    {":alpha:", GlyphType::CHARACTER, 'A', nullptr, 0, 0},
    {":pack:", GlyphType::CHARACTER, 'P', nullptr, 0, 0},
    {nullptr, GlyphType::CHARACTER, 0, nullptr, 0, 0}  // Sentinel
};

// Structure to track bitmap glyph positions for rendering
struct BitmapGlyph {
    int16_t x;              // X position to draw
    const uint8_t* bitmap;  // Bitmap data
    uint8_t width;
    uint8_t height;
};

#define MAX_BITMAP_GLYPHS 4  // Max bitmap glyphs per line

// Result of processing glyphs in a string
struct GlyphRenderResult {
    String text;                             // Text with glyphs replaced
    BitmapGlyph bitmaps[MAX_BITMAP_GLYPHS];  // Bitmap glyphs to draw
    uint8_t bitmapCount;                     // Number of bitmap glyphs
};

// Replace glyph tokens in a string with display characters
// For simple cases where bitmap positions aren't needed
inline String renderGlyphs(const String& input) {
    String result = input;
    for (int i = 0; GLYPHS[i].token != nullptr; i++) {
        result.replace(GLYPHS[i].token, String(GLYPHS[i].display));
    }
    return result;
}

#endif // PROTOCOL_H
