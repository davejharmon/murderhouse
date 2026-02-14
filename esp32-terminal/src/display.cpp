// Display Driver Implementation for SSD1322 256x64 OLED
#include "display.h"
#include "config.h"
#include "icons.h"
#include <U8g2lib.h>
#include <SPI.h>

// U8g2 constructor for SSD1322 256x64 (4-wire SPI)
// Using hardware SPI with custom pins
U8G2_SSD1322_NHD_256X64_F_4W_HW_SPI u8g2(
    U8G2_R2,           // Rotation (180° for upside-down mount)
    PIN_OLED_CS,       // CS
    PIN_OLED_DC,       // DC
    PIN_OLED_RST       // Reset
);

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

// Process text to extract bitmap glyphs and their positions
// Returns the text with bitmap glyphs replaced by spaces
static GlyphRenderResult processGlyphsForRender(const String& input, int startX, int charWidth) {
    GlyphRenderResult result;
    result.text = input;
    result.bitmapCount = 0;

    // Process each glyph type
    for (int i = 0; GLYPHS[i].token != nullptr; i++) {
        if (GLYPHS[i].type == GlyphType::CHARACTER) {
            // Simple character replacement
            result.text.replace(GLYPHS[i].token, String(GLYPHS[i].display));
        } else if (GLYPHS[i].type == GlyphType::BITMAP) {
            // Find all occurrences of this bitmap glyph
            int pos = 0;
            String searchText = result.text;
            while ((pos = searchText.indexOf(GLYPHS[i].token)) != -1 &&
                   result.bitmapCount < MAX_BITMAP_GLYPHS) {
                // Calculate the X position for this glyph
                // Position = startX + (characters before glyph * char width)
                int xPos = startX + (pos * charWidth);

                // Store bitmap info
                result.bitmaps[result.bitmapCount].x = xPos;
                result.bitmaps[result.bitmapCount].bitmap = GLYPHS[i].bitmap;
                result.bitmaps[result.bitmapCount].width = GLYPHS[i].width;
                result.bitmaps[result.bitmapCount].height = GLYPHS[i].height;
                result.bitmapCount++;

                // Replace with space in the result text
                result.text.replace(GLYPHS[i].token, " ");
                searchText = result.text;  // Update search text for next iteration
            }
        }
    }

    return result;
}

// Draw bitmap glyphs at their calculated positions
static void drawBitmapGlyphs(const GlyphRenderResult& glyphs, int baselineY, int fontHeight) {
    for (uint8_t i = 0; i < glyphs.bitmapCount; i++) {
        const BitmapGlyph& g = glyphs.bitmaps[i];
        // Center bitmap vertically relative to text baseline
        // Baseline is at bottom of text, so we need to offset upward
        int yPos = baselineY - fontHeight + (fontHeight - g.height) / 2;
        u8g2.drawXBM(g.x, yPos, g.width, g.height, g.bitmap);
    }
}

void displayInit() {
    // Initialize SPI with ESP32-S3 pins
    SPI.begin(PIN_OLED_CLK, -1, PIN_OLED_MOSI, PIN_OLED_CS);

    // Initialize U8g2
    u8g2.begin();
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

void displayRender(const DisplayState& state) {
    u8g2.clearBuffer();

    // === ICON COLUMN ===
    for (int i = 0; i < 3; i++) {
        const uint8_t* bitmap = getIconBitmap(state.icons[i].id);
        drawIconXBM(bitmap, ICON_COL_X, ICON_Y[i]);
    }
    // Draw selection bar next to the active icon slot
    drawSelectionBar(state.idleScrollIndex);

    // === LINE 1: Context (small, left and right aligned) ===
    u8g2.setFont(FONT_SMALL);
    u8g2.setDrawColor(1);

    // Get character width for position calculations
    int charWidth = u8g2.getMaxCharWidth();
    int fontHeight = 10;  // FONT_SMALL is 10px height

    // Left side - process for bitmap glyphs
    GlyphRenderResult leftGlyphs = processGlyphsForRender(state.line1.left, MARGIN_X, charWidth);
    u8g2.drawStr(MARGIN_X, LINE1_Y, leftGlyphs.text.c_str());
    drawBitmapGlyphs(leftGlyphs, LINE1_Y, fontHeight);

    // Right side (right-aligned within text area)
    if (state.line1.right.length() > 0) {
        String rightText = renderGlyphs(state.line1.right);
        int rightWidth = u8g2.getStrWidth(rightText.c_str());
        int rightStartX = TEXT_AREA_W - rightWidth - MARGIN_X;

        GlyphRenderResult rightGlyphs = processGlyphsForRender(state.line1.right, rightStartX, charWidth);
        u8g2.drawStr(rightStartX, LINE1_Y, rightGlyphs.text.c_str());
        drawBitmapGlyphs(rightGlyphs, LINE1_Y, fontHeight);
    }

    // === LINE 2: Main content (large, centered within text area) ===
    u8g2.setFont(FONT_LARGE);

    String line2Text = renderGlyphs(state.line2.text);
    int line2Width = u8g2.getStrWidth(line2Text.c_str());
    int line2X = (TEXT_AREA_W - line2Width) / 2;

    // Draw based on style
    if (state.line2.style == DisplayStyle::ABSTAINED) {
        u8g2.setDrawColor(1);
    } else if (state.line2.style == DisplayStyle::LOCKED) {
        u8g2.setDrawColor(1);
        u8g2.drawFrame(line2X - 4, LINE2_Y - 18, line2Width + 8, 22);
    } else if (state.line2.style == DisplayStyle::WAITING) {
        u8g2.setDrawColor(1);
    }

    u8g2.drawStr(line2X, LINE2_Y, line2Text.c_str());

    // === LINE 3: Tutorial/tip (small, centered or left/right within text area) ===
    u8g2.setFont(FONT_SMALL);
    u8g2.setDrawColor(1);

    if (state.line3.left.length() > 0 || state.line3.right.length() > 0) {
        if (state.line3.left.length() > 0) {
            String leftText = renderGlyphs(state.line3.left);
            u8g2.drawStr(MARGIN_X, LINE3_Y, leftText.c_str());
        }
        if (state.line3.center.length() > 0) {
            String centerText = renderGlyphs(state.line3.center);
            int centerWidth = u8g2.getStrWidth(centerText.c_str());
            u8g2.drawStr((TEXT_AREA_W - centerWidth) / 2, LINE3_Y, centerText.c_str());
        }
        if (state.line3.right.length() > 0) {
            String rightText = renderGlyphs(state.line3.right);
            int rightWidth = u8g2.getStrWidth(rightText.c_str());
            u8g2.drawStr(TEXT_AREA_W - rightWidth - MARGIN_X, LINE3_Y, rightText.c_str());
        }
    } else {
        String line3Text = renderGlyphs(state.line3.text);
        int line3Width = u8g2.getStrWidth(line3Text.c_str());
        int line3X = (TEXT_AREA_W - line3Width) / 2;
        u8g2.drawStr(line3X, LINE3_Y, line3Text.c_str());
    }

    // Send buffer to display
    u8g2.sendBuffer();
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
    u8g2.drawStr(MARGIN_X, LINE1_Y, "SELECT PLAYER");

    // === LINE 2: Selected player number (large, centered) ===
    u8g2.setFont(FONT_LARGE);
    char playerText[16];
    snprintf(playerText, sizeof(playerText), "PLAYER %d", selectedPlayer);
    int textWidth = u8g2.getStrWidth(playerText);
    int textX = (DISPLAY_WIDTH - textWidth) / 2;

    // Draw selection box
    u8g2.drawFrame(textX - 6, LINE2_Y - 18, textWidth + 12, 24);
    u8g2.drawStr(textX, LINE2_Y, playerText);

    // === LINE 3: Instructions ===
    u8g2.setFont(FONT_SMALL);
    const char* instructions = "DIAL select - YES confirm";
    int instrWidth = u8g2.getStrWidth(instructions);
    int instrX = (DISPLAY_WIDTH - instrWidth) / 2;
    u8g2.drawStr(instrX, LINE3_Y, instructions);

    u8g2.sendBuffer();
}

void displayConnectionStatus(ConnectionState connState, const char* detail) {
    const char* line1 = "";
    const char* line2 = "";
    const char* line3 = "";

    switch (connState) {
        case ConnectionState::BOOT:
            line1 = "CONNECTING...";
            line2 = "BOOTING";
            line3 = "Initializing...";
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
