// Display Driver Implementation for SSD1322 256x64 OLED
#include "display.h"
#include "config.h"
#include "icons.h"
#include <U8g2lib.h>
#include <SPI.h>
#include <esp_mac.h>
#include <Preferences.h>

static Preferences prefs;

// U8g2 constructor for SSD1322 256x64 (4-wire SPI)
// Screen mode is selected at runtime on the player select screen (NO button toggles)
U8G2_SSD1322_NHD_256X64_F_4W_HW_SPI u8g2(
    U8G2_R0,
    PIN_OLED_CS, PIN_OLED_DC, PIN_OLED_RST
);

// Screen mode: 0 = NHD, 1 = SSD1322U
static uint8_t screenMode = 0;

// Font definitions
// Small font for line 1 and line 3 (~10px height)
#define FONT_SMALL u8g2_font_6x10_tf

// Large font for line 2 (~20px height, bold)
#define FONT_LARGE u8g2_font_10x20_tf

// Display layout constants
#define LINE1_Y       12    // Top of line 1
#define LINE2_Y       42    // Center of display (line 2)
#define LINE3_Y       60    // Bottom of display (line 3)

#define MARGIN_X      4     // Left/right margin

// Icon column layout (2px whitespace gap between text area and icons)
#define TEXT_AREA_W   234   // Width of text area
#define ICON_COL_X    236   // Start of icon column
#define ICON_SLOT_SIZE 18   // 18x18 icons
#define ICON_SLOT_H   20   // 20px per slot (icon + centering)
#define BAR_X         254  // X position of selection bar
#define BAR_W         2    // Width of selection bar
static const int ICON_Y[] = {1, 23, 45};    // Y positions for 3 icons (centered in slots)
static const int SLOT_Y[] = {0, 22, 44};    // Y positions for 3 slots (for bar)

static void applyScreenMode() {
    if (screenMode == 0) {
        // NHD panels: 180° rotation, no flip
        u8g2.setDisplayRotation(U8G2_R2);
        u8g2.setFlipMode(0);
    } else {
        // SSD1322U panels: no rotation, flip to correct mirroring
        u8g2.setDisplayRotation(U8G2_R0);
        u8g2.setFlipMode(1);
    }
}

void displayInit() {
    // Initialize SPI with ESP32-S3 pins
    SPI.begin(PIN_OLED_CLK, -1, PIN_OLED_MOSI, PIN_OLED_CS);

    // Load saved screen mode from NVS
    prefs.begin("display", true);  // read-only
    screenMode = prefs.getUChar("screenMode", 0);
    prefs.end();
    Serial.printf("[Display] Screen mode: %s\n", screenMode == 0 ? "NHD" : "SSD1322U");

    // Initialize U8g2
    u8g2.begin();
    applyScreenMode();
    u8g2.setContrast(255);  // Max contrast for amber OLED
    u8g2.clearBuffer();
    u8g2.sendBuffer();
}

void displayClear() {
    u8g2.clearBuffer();
    u8g2.sendBuffer();
}

// Get display style color (for style variations)
// SSD1322 is grayscale, so we use different gray levels
uint8_t getStyleColor(DisplayStyle style) {
    switch (style) {
        case DisplayStyle::LOCKED:
        case DisplayStyle::CRITICAL:
            return 255;  // Bright
        case DisplayStyle::ABSTAINED:
            return 128;  // Dim
        case DisplayStyle::WAITING:
            return 200;  // Slightly dim
        default:
            return 255;  // Normal = bright
    }
}

// Draw an 18x18 XBM icon from PROGMEM at (x, y)
static void drawIconXBM(const uint8_t* icon, int x, int y) {
    if (icon == nullptr) return;
    u8g2.setDrawColor(1);
    u8g2.drawXBMP(x, y, ICON_SIZE, ICON_SIZE, icon);
}

// Draw the selection bar indicator at the active icon slot
static void drawSelectionBar(int activeIndex) {
    if (activeIndex < 0 || activeIndex > 2) return;
    u8g2.setDrawColor(1);
    u8g2.drawBox(BAR_X, SLOT_Y[activeIndex], BAR_W, ICON_SLOT_H);
}

// Operator sentence mode: 3 lines of FONT_SMALL across the full display height.
// line1.left = committed sentence, line2.text = preview word (inverted box),
// line1.right = category label ("1".."4" or ""), icons[2] = op_tick or empty.
static void _renderOperator(const DisplayState& state) {
    static const int OP_Y[]    = {14, 34, 54};   // baselines for 3 evenly-spaced lines
    static const int MAX_CHARS = 37;              // max chars per line at 6px each

    // Build combined text
    String sentence = state.line1.left;
    String preview  = state.line2.text;
    String combined;
    if (sentence.length() > 0 && preview.length() > 0)
        combined = sentence + " " + preview;
    else if (sentence.length() > 0)
        combined = sentence;
    else
        combined = preview;

    // Word-wrap into 3 rows
    String rows[3] = {"", "", ""};
    int rowIdx = 0;
    int pos = 0;
    while (pos < (int)combined.length() && rowIdx < 3) {
        int sp = combined.indexOf(' ', pos);
        String word = (sp == -1) ? combined.substring(pos) : combined.substring(pos, sp);
        pos = (sp == -1) ? combined.length() : sp + 1;
        if (word.length() == 0) continue;
        String candidate = rows[rowIdx].length() > 0 ? rows[rowIdx] + " " + word : word;
        if ((int)candidate.length() <= MAX_CHARS) {
            rows[rowIdx] = candidate;
        } else if (rowIdx < 2) {
            rowIdx++;
            rows[rowIdx] = word;
        }
    }

    // Find which row contains the preview word (it's the last word = end of last non-empty row)
    int previewRow = -1;
    int previewCharX = MARGIN_X;
    if (preview.length() > 0) {
        for (int r = 2; r >= 0; r--) {
            if (rows[r].length() >= preview.length() && rows[r].endsWith(preview)) {
                previewRow = r;
                int prefixLen = rows[r].length() - preview.length();
                previewCharX = MARGIN_X + prefixLen * 6; // FONT_SMALL = 6px/char
                break;
            }
        }
    }

    u8g2.setFont(FONT_SMALL);

    // Render rows
    for (int r = 0; r < 3; r++) {
        if (rows[r].length() == 0) continue;

        if (r == previewRow && preview.length() > 0) {
            // Draw committed prefix
            int prefixLen = rows[r].length() - preview.length();
            String prefix = rows[r].substring(0, prefixLen);
            u8g2.setDrawColor(1);
            if (prefix.length() > 0) u8g2.drawStr(MARGIN_X, OP_Y[r], prefix.c_str());

            // Draw inverted box behind preview word
            int previewW = u8g2.getStrWidth(preview.c_str());
            u8g2.setDrawColor(1);
            u8g2.drawBox(previewCharX - 1, OP_Y[r] - 9, previewW + 2, 11);

            // Draw preview text dark-on-bright
            u8g2.setDrawColor(0);
            u8g2.drawStr(previewCharX, OP_Y[r], preview.c_str());
            u8g2.setDrawColor(1);
        } else {
            u8g2.setDrawColor(1);
            u8g2.drawStr(MARGIN_X, OP_Y[r], rows[r].c_str());
        }
    }

    // === ICON COLUMN (operator mode) ===
    // Slot 0: category label (line1.right = "1".."4")
    if (state.line1.right.length() > 0) {
        u8g2.setFont(FONT_SMALL);
        u8g2.setDrawColor(1);
        int lw = u8g2.getStrWidth(state.line1.right.c_str());
        int lx = ICON_COL_X + (ICON_SLOT_SIZE - lw) / 2;
        u8g2.drawStr(lx, ICON_Y[0] + 12, state.line1.right.c_str()); // baseline centred in 18px slot
    }

    // Slot 2: op_tick icon when ready
    if (state.icons[2].id == "op_tick") {
        drawIconXBM(getIconBitmap("op_tick"), ICON_COL_X, ICON_Y[2]);
    }
}

// Internal: draw the full display state into u8g2 buffer and send it
static void _renderBuffer(const DisplayState& state) {
    u8g2.clearBuffer();

    // Operator sentence mode uses completely different layout
    if (state.line2.style == DisplayStyle::OPERATOR) {
        _renderOperator(state);
        u8g2.sendBuffer();
        return;
    }

    // === ICON COLUMN ===
    for (int i = 0; i < 3; i++) {
        const uint8_t* bitmap = getIconBitmap(state.icons[i].id);
        drawIconXBM(bitmap, ICON_COL_X, ICON_Y[i]);
    }
    // Draw selection bar next to the active icon slot (only if 2+ icons visible)
    int visibleIcons = 0;
    for (int i = 0; i < 3; i++) {
        if (state.icons[i].id != "empty") visibleIcons++;
    }
    if (visibleIcons >= 2) {
        // Prefer ACTIVE icon state (set by server during events) over idleScrollIndex
        int barIdx = state.idleScrollIndex;
        for (int i = 0; i < 3; i++) {
            if (state.icons[i].state == IconState::ACTIVE) { barIdx = i; break; }
        }
        drawSelectionBar(barIdx);
    }

    // === LINE 1: Context (small, left and right aligned) ===
    u8g2.setFont(FONT_SMALL);
    u8g2.setDrawColor(1);

    u8g2.drawStr(MARGIN_X, LINE1_Y, state.line1.left.c_str());

    if (state.line1.right.length() > 0) {
        int rightWidth = u8g2.getStrWidth(state.line1.right.c_str());
        u8g2.drawStr(TEXT_AREA_W - rightWidth - MARGIN_X, LINE1_Y, state.line1.right.c_str());
    }

    // === LINE 2: Main content (large, centered within text area) ===
    u8g2.setFont(FONT_LARGE);

    int line2Width = u8g2.getStrWidth(state.line2.text.c_str());
    int line2X = (TEXT_AREA_W - line2Width) / 2;

    // Draw based on style
    u8g2.setDrawColor(1);
    if (state.line2.style == DisplayStyle::LOCKED) {
        u8g2.drawFrame(line2X - 4, LINE2_Y - 18, line2Width + 8, 22);
    }

    u8g2.drawStr(line2X, LINE2_Y, state.line2.text.c_str());

    // === LINE 3: Tutorial/tip (small, centered or left/right within text area) ===
    u8g2.setFont(FONT_SMALL);
    u8g2.setDrawColor(1);

    if (state.line3.left.length() > 0 || state.line3.right.length() > 0) {
        if (state.line3.left.length() > 0) {
            u8g2.drawStr(MARGIN_X, LINE3_Y, state.line3.left.c_str());
        }
        if (state.line3.center.length() > 0) {
            int centerWidth = u8g2.getStrWidth(state.line3.center.c_str());
            u8g2.drawStr((TEXT_AREA_W - centerWidth) / 2, LINE3_Y, state.line3.center.c_str());
        }
        if (state.line3.right.length() > 0) {
            int rightWidth = u8g2.getStrWidth(state.line3.right.c_str());
            u8g2.drawStr(TEXT_AREA_W - rightWidth - MARGIN_X, LINE3_Y, state.line3.right.c_str());
        }
    } else {
        int line3Width = u8g2.getStrWidth(state.line3.text.c_str());
        int line3X = (TEXT_AREA_W - line3Width) / 2;
        u8g2.drawStr(line3X, LINE3_Y, state.line3.text.c_str());
    }

    // Send buffer to display
    u8g2.sendBuffer();
}

void displayRender(const DisplayState& state) {
    // Operator mode renders once (inverted box provides the visual, no blink animation)
    if (state.line2.style == DisplayStyle::OPERATOR) {
        _renderBuffer(state);
        return;
    }

    // Critical content only flashes on first display — track seen text so
    // scrolling away and back does not re-trigger the blink animation.
    static String lastCriticalText = "";
    bool isCritical = state.line2.style == DisplayStyle::CRITICAL;
    bool isNewCritical = isCritical && state.line2.text != lastCriticalText;
    if (isCritical) lastCriticalText = state.line2.text;

    int blinkCycles = isNewCritical ? 3 : 1;

    for (int blink = 0; blink < blinkCycles; blink++) {
        if (blink > 0) {
            // Blank frame between blinks
            delay(150);
            u8g2.clearBuffer();
            u8g2.sendBuffer();
            delay(150);
        }
        _renderBuffer(state);
    }
}

void displayMessage(const char* line1, const char* line2, const char* line3) {
    DisplayState state;
    state.line1.left = line1;
    state.line1.right = "";
    state.line2.text = line2;
    state.line2.style = DisplayStyle::NORMAL;
    state.line3.text = line3;
    displayRender(state);
}

void displayPlayerSelect(uint8_t selectedPlayer) {
    u8g2.clearBuffer();

    // === LINE 1: Title ===
    u8g2.setFont(FONT_SMALL);
    u8g2.setDrawColor(1);
    char selectTitle[32];
    uint8_t mac[6];
    esp_efuse_mac_get_default(mac);
    snprintf(selectTitle, sizeof(selectTitle), "%s:%02X > SELECT TERMINAL", FIRMWARE_VERSION, mac[5]);
    u8g2.drawStr(MARGIN_X, LINE1_Y, selectTitle);

    // === LINE 2: Selected player/operator (large, centered) ===
    u8g2.setFont(FONT_LARGE);
    char playerText[16];
    if (selectedPlayer == 0) {
        snprintf(playerText, sizeof(playerText), "OPERATOR");
    } else {
        snprintf(playerText, sizeof(playerText), "PLAYER %d", selectedPlayer);
    }
    int textWidth = u8g2.getStrWidth(playerText);
    int textX = (DISPLAY_WIDTH - textWidth) / 2;

    // Draw selection box
    u8g2.drawFrame(textX - 6, LINE2_Y - 18, textWidth + 12, 24);
    u8g2.drawStr(textX, LINE2_Y, playerText);

    // === LINE 3: Instructions + screen mode ===
    u8g2.setFont(FONT_SMALL);
    u8g2.drawStr(MARGIN_X, LINE3_Y, "YES confirm");
    // Show screen mode on the right (encoder tap toggles)
    const char* modeName = screenMode == 0 ? "NHD" : "SSD1322U";
    char modeLabel[24];
    snprintf(modeLabel, sizeof(modeLabel), "PUSH: %s", modeName);
    int modeWidth = u8g2.getStrWidth(modeLabel);
    u8g2.drawStr(DISPLAY_WIDTH - modeWidth - MARGIN_X, LINE3_Y, modeLabel);

    u8g2.sendBuffer();
}

void displayToggleScreenMode() {
    screenMode = (screenMode + 1) % 2;
    applyScreenMode();

    // Save to NVS
    prefs.begin("display", false);  // read-write
    prefs.putUChar("screenMode", screenMode);
    prefs.end();

    Serial.printf("[Display] Screen mode changed to: %s\n", screenMode == 0 ? "NHD" : "SSD1322U");
}

const char* displayGetScreenModeName() {
    return screenMode == 0 ? "NHD" : "SSD1322U";
}

void displayConnectionStatus(ConnectionState connState, const char* detail) {
    const char* line1 = "";
    const char* line2 = "";
    const char* line3 = "";

    switch (connState) {
        case ConnectionState::BOOT:
            line1 = "MURDERHOUSE";
            line2 = "BOOTING";
            line3 = "v" FIRMWARE_VERSION;
            break;

        case ConnectionState::PLAYER_SELECT:
            // Handled separately by displayPlayerSelect()
            return;

        case ConnectionState::WIFI_CONNECTING:
            line1 = "CONNECTING...";
            line2 = "WIFI";
            line3 = detail ? detail : "Searching for network...";
            break;

        case ConnectionState::DISCOVERING:
            line1 = "CONNECTING...";
            line2 = "SCANNING";
            line3 = detail ? detail : "Looking for server...";
            break;

        case ConnectionState::WS_CONNECTING:
            line1 = "CONNECTING...";
            line2 = "SERVER";
            line3 = detail ? detail : "Establishing link...";
            break;

        case ConnectionState::JOINING:
            line1 = "CONNECTING...";
            line2 = "JOINING";
            line3 = detail ? detail : "Registering player...";
            break;

        case ConnectionState::CONNECTED:
            line1 = "CONNECTING...";
            line2 = "READY";
            line3 = detail ? detail : "Waiting for game state...";
            break;

        case ConnectionState::RECONNECTING:
            line1 = "CONNECTING...";
            line2 = "RECONNECTING";
            line3 = detail ? detail : "Please wait...";
            break;

        case ConnectionState::ERROR:
            line1 = "CONNECTING...";
            line2 = "ERROR";
            line3 = detail ? detail : "Press button to retry";
            break;
    }

    displayMessage(line1, line2, line3);
}
