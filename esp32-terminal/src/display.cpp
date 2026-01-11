// Display Driver Implementation for SSD1322 256x64 OLED
#include "display.h"
#include "config.h"
#include <U8g2lib.h>
#include <SPI.h>

// U8g2 constructor for SSD1322 256x64 (4-wire SPI)
// Using hardware SPI with custom pins
U8G2_SSD1322_NHD_256X64_F_4W_HW_SPI u8g2(
    U8G2_R0,           // Rotation
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

void displayInit() {
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

void displayRender(const DisplayState& state) {
    u8g2.clearBuffer();

    // === LINE 1: Context (small, left and right aligned) ===
    u8g2.setFont(FONT_SMALL);
    u8g2.setDrawColor(1);

    // Left side
    String leftText = renderGlyphs(state.line1.left);
    u8g2.drawStr(MARGIN_X, LINE1_Y, leftText.c_str());

    // Right side (right-aligned)
    String rightText = renderGlyphs(state.line1.right);
    int rightWidth = u8g2.getStrWidth(rightText.c_str());
    u8g2.drawStr(DISPLAY_WIDTH - rightWidth - MARGIN_X, LINE1_Y, rightText.c_str());

    // === LINE 2: Main content (large, centered) ===
    u8g2.setFont(FONT_LARGE);

    // Apply style (grayscale variation)
    // Note: SSD1322 supports grayscale, but U8g2 may need specific mode
    // For now, we'll use a simple approach

    String line2Text = renderGlyphs(state.line2.text);
    int line2Width = u8g2.getStrWidth(line2Text.c_str());
    int line2X = (DISPLAY_WIDTH - line2Width) / 2;

    // Draw based on style
    if (state.line2.style == DisplayStyle::ABSTAINED) {
        // Draw dimmer (we can't easily do this with U8g2, so just draw normal)
        u8g2.setDrawColor(1);
    } else if (state.line2.style == DisplayStyle::LOCKED) {
        // Draw with a box around it for emphasis
        u8g2.setDrawColor(1);
        u8g2.drawFrame(line2X - 4, LINE2_Y - 18, line2Width + 8, 22);
    } else if (state.line2.style == DisplayStyle::WAITING) {
        // Could add animation here (handled in main loop)
        u8g2.setDrawColor(1);
    }

    u8g2.drawStr(line2X, LINE2_Y, line2Text.c_str());

    // === LINE 3: Tutorial/tip (small, centered) ===
    u8g2.setFont(FONT_SMALL);
    u8g2.setDrawColor(1);

    String line3Text = renderGlyphs(state.line3.text);
    int line3Width = u8g2.getStrWidth(line3Text.c_str());
    int line3X = (DISPLAY_WIDTH - line3Width) / 2;
    u8g2.drawStr(line3X, LINE3_Y, line3Text.c_str());

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

void displayConnectionStatus(ConnectionState connState, const char* detail) {
    const char* line1 = "";
    const char* line2 = "";
    const char* line3 = "";

    switch (connState) {
        case ConnectionState::BOOT:
            line1 = "MURDERHOUSE";
            line2 = "BOOTING";
            line3 = "Initializing...";
            break;

        case ConnectionState::WIFI_CONNECTING:
            line1 = "NETWORK";
            line2 = "CONNECTING";
            line3 = detail ? detail : "Searching for WiFi...";
            break;

        case ConnectionState::WS_CONNECTING:
            line1 = "SERVER";
            line2 = "CONNECTING";
            line3 = detail ? detail : "Establishing link...";
            break;

        case ConnectionState::JOINING:
            line1 = "GAME";
            line2 = "JOINING";
            line3 = detail ? detail : "Registering player...";
            break;

        case ConnectionState::CONNECTED:
            line1 = "CONNECTED";
            line2 = "READY";
            line3 = detail ? detail : "Waiting for game state...";
            break;

        case ConnectionState::RECONNECTING:
            line1 = "CONNECTION LOST";
            line2 = "RECONNECTING";
            line3 = detail ? detail : "Please wait...";
            break;
    }

    displayMessage(line1, line2, line3);
}
