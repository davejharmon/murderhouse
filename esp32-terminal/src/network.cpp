// Network Layer Implementation
#include "network.h"
#include "config.h"
#include <WiFi.h>
#include <WiFiUdp.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// WebSocket client
static WebSocketsClient webSocket;

// UDP discovery
static WiFiUDP udp;
static char serverHost[16] = "";  // Discovered server IP
static uint16_t serverPort = WS_PORT;
static unsigned long lastDiscoveryBroadcast = 0;

// Player ID (set before init)
static char playerId[16] = "1";  // Default to player 1

// Connection state
static ConnectionState connState = ConnectionState::BOOT;
static bool wsConnected = false;
static bool gameJoined = false;
static unsigned long lastReconnectAttempt = 0;
static char lastError[128] = "";

// Display state callback
static DisplayStateCallback displayCallback = nullptr;

// Current display state
static DisplayState currentDisplayState;

// Forward declarations
static void onWebSocketEvent(WStype_t type, uint8_t* payload, size_t length);
static void parsePlayerState(JsonObject& payload);
static void sendMessage(const char* type, JsonObject* payload = nullptr);

void networkSetPlayerId(uint8_t playerNum) {
    // Use just the number to match the web client format
    snprintf(playerId, sizeof(playerId), "%d", playerNum);
    Serial.print("Player ID set to: ");
    Serial.println(playerId);
}

void networkInit() {
    connState = ConnectionState::WIFI_CONNECTING;

    // Start WiFi connection
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    Serial.print("Connecting to WiFi: ");
    Serial.println(WIFI_SSID);
    Serial.print("Player ID: ");
    Serial.println(playerId);
}

void networkSetDisplayCallback(DisplayStateCallback callback) {
    displayCallback = callback;
}

ConnectionState networkUpdate() {
    unsigned long now = millis();

    switch (connState) {
        case ConnectionState::BOOT:
            // Should not be here after init
            connState = ConnectionState::WIFI_CONNECTING;
            break;

        case ConnectionState::WIFI_CONNECTING:
            if (WiFi.status() == WL_CONNECTED) {
                Serial.print("WiFi connected. IP: ");
                Serial.println(WiFi.localIP());

                if (serverHost[0] != '\0') {
                    // Already discovered server (reconnecting), go straight to WS
                    webSocket.begin(serverHost, serverPort, WS_PATH);
                    webSocket.onEvent(onWebSocketEvent);
                    webSocket.setReconnectInterval(WS_RECONNECT_MS);
                    connState = ConnectionState::WS_CONNECTING;
                } else {
                    // Need to discover server first
                    udp.begin(DISCOVERY_PORT);
                    lastDiscoveryBroadcast = 0;  // Broadcast immediately
                    connState = ConnectionState::DISCOVERING;
                }
            }
            break;

        case ConnectionState::DISCOVERING: {
            unsigned long now2 = millis();
            // Send broadcast periodically
            if (now2 - lastDiscoveryBroadcast >= DISCOVERY_TIMEOUT_MS) {
                Serial.println("Broadcasting discovery...");
                udp.beginPacket(IPAddress(255, 255, 255, 255), DISCOVERY_PORT);
                udp.print(DISCOVERY_MSG);
                udp.endPacket();
                lastDiscoveryBroadcast = now2;
            }

            // Check for response
            int packetSize = udp.parsePacket();
            if (packetSize > 0) {
                char buf[64];
                int len = udp.read(buf, sizeof(buf) - 1);
                buf[len] = '\0';

                // Check for valid response
                if (strncmp(buf, DISCOVERY_RESP, strlen(DISCOVERY_RESP)) == 0) {
                    // Parse port from response
                    serverPort = atoi(buf + strlen(DISCOVERY_RESP));
                    if (serverPort == 0) serverPort = WS_PORT;

                    // Use the sender's IP as the server address
                    IPAddress remoteIP = udp.remoteIP();
                    snprintf(serverHost, sizeof(serverHost), "%d.%d.%d.%d",
                             remoteIP[0], remoteIP[1], remoteIP[2], remoteIP[3]);

                    Serial.print("Server found at ");
                    Serial.print(serverHost);
                    Serial.print(":");
                    Serial.println(serverPort);

                    udp.stop();

                    // Connect WebSocket
                    webSocket.begin(serverHost, serverPort, WS_PATH);
                    webSocket.onEvent(onWebSocketEvent);
                    webSocket.setReconnectInterval(WS_RECONNECT_MS);
                    connState = ConnectionState::WS_CONNECTING;
                }
            }
            break;
        }

        case ConnectionState::WS_CONNECTING:
            webSocket.loop();
            if (wsConnected && !gameJoined) {
                // Send join message
                StaticJsonDocument<128> doc;
                doc["playerId"] = playerId;
                doc["source"] = "terminal";
                JsonObject payload = doc.as<JsonObject>();
                sendMessage(ClientMsg::JOIN, &payload);
                connState = ConnectionState::JOINING;
            }
            break;

        case ConnectionState::JOINING:
            webSocket.loop();
            if (gameJoined) {
                connState = ConnectionState::CONNECTED;
            } else if (!wsConnected) {
                connState = ConnectionState::RECONNECTING;
            }
            break;

        case ConnectionState::CONNECTED:
            webSocket.loop();
            if (!wsConnected) {
                gameJoined = false;
                connState = ConnectionState::RECONNECTING;
            }
            break;

        case ConnectionState::RECONNECTING:
            webSocket.loop();
            if (WiFi.status() != WL_CONNECTED) {
                // WiFi lost, try to reconnect
                WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
                connState = ConnectionState::WIFI_CONNECTING;
            } else if (wsConnected) {
                // WebSocket reconnected, rejoin game
                StaticJsonDocument<128> doc;
                doc["playerId"] = playerId;
                doc["source"] = "terminal";
                JsonObject payload = doc.as<JsonObject>();
                sendMessage(ClientMsg::REJOIN, &payload);
                connState = ConnectionState::JOINING;
            }
            break;

        case ConnectionState::ERROR:
            // Stay in error state until retryJoin() is called
            webSocket.loop();
            break;
    }

    return connState;
}

void networkRetryJoin() {
    if (connState == ConnectionState::ERROR) {
        Serial.println("Retrying join...");
        lastError[0] = '\0';  // Clear error message

        if (wsConnected) {
            // WebSocket still connected, just resend join
            StaticJsonDocument<128> doc;
            doc["playerId"] = playerId;
            JsonObject payload = doc.as<JsonObject>();
            sendMessage(ClientMsg::JOIN, &payload);
            connState = ConnectionState::JOINING;
        } else {
            // Need to reconnect WebSocket
            connState = ConnectionState::RECONNECTING;
        }
    }
}

bool networkIsConnected() {
    return connState == ConnectionState::CONNECTED && wsConnected && gameJoined;
}

static void sendMessage(const char* type, JsonObject* payload) {
    StaticJsonDocument<256> doc;
    doc["type"] = type;

    if (payload != nullptr) {
        doc["payload"] = *payload;
    } else {
        doc.createNestedObject("payload");
    }

    String json;
    serializeJson(doc, json);

    Serial.print("Sending: ");
    Serial.println(json);

    webSocket.sendTXT(json);
}

void networkSendSelectUp() {
    if (networkIsConnected()) {
        sendMessage(ClientMsg::SELECT_UP);
    }
}

void networkSendSelectDown() {
    if (networkIsConnected()) {
        sendMessage(ClientMsg::SELECT_DOWN);
    }
}

void networkSendConfirm() {
    if (networkIsConnected()) {
        sendMessage(ClientMsg::CONFIRM);
    }
}

void networkSendAbstain() {
    if (networkIsConnected()) {
        sendMessage(ClientMsg::ABSTAIN);
    }
}

void networkSendUseItem(const char* itemId) {
    if (networkIsConnected()) {
        StaticJsonDocument<128> doc;
        doc["itemId"] = itemId;
        JsonObject payload = doc.as<JsonObject>();
        sendMessage(ClientMsg::USE_ITEM, &payload);
    }
}

const char* networkGetLastError() {
    return lastError;
}

static void onWebSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
    switch (type) {
        case WStype_DISCONNECTED:
            Serial.println("WebSocket disconnected");
            wsConnected = false;
            gameJoined = false;
            break;

        case WStype_CONNECTED:
            Serial.print("WebSocket connected to: ");
            Serial.println((char*)payload);
            wsConnected = true;
            break;

        case WStype_TEXT: {
            Serial.print("Received: ");
            Serial.println((char*)payload);

            // Parse JSON message
            StaticJsonDocument<2048> doc;
            DeserializationError error = deserializeJson(doc, payload, length);

            if (error) {
                Serial.print("JSON parse error: ");
                Serial.println(error.c_str());
                return;
            }

            const char* msgType = doc["type"];
            JsonObject msgPayload = doc["payload"];

            // Validate message type exists
            if (msgType == nullptr) {
                Serial.println("Message missing type field");
                return;
            }

            // Handle message types
            if (strcmp(msgType, ServerMsg::WELCOME) == 0) {
                Serial.println("Received welcome - joined game");
                gameJoined = true;
            }
            else if (strcmp(msgType, ServerMsg::ERROR) == 0) {
                const char* errorMsg = msgPayload["message"] | "Unknown error";
                strncpy(lastError, errorMsg, sizeof(lastError) - 1);
                lastError[sizeof(lastError) - 1] = '\0';  // Ensure null termination
                Serial.print("Server error: ");
                Serial.println(errorMsg);
                // If we were trying to join, transition to error state
                if (connState == ConnectionState::JOINING) {
                    connState = ConnectionState::ERROR;
                }
            }
            else if (strcmp(msgType, ServerMsg::PLAYER_STATE) == 0) {
                parsePlayerState(msgPayload);
            }
            else if (strcmp(msgType, ServerMsg::GAME_STATE) == 0) {
                // Game state updates - we mainly care about playerState
                Serial.println("Received game state update");
            }
            else if (strcmp(msgType, ServerMsg::EVENT_PROMPT) == 0) {
                Serial.println("Received event prompt");
            }
            break;
        }

        case WStype_BIN:
            Serial.println("Received binary data (unexpected)");
            break;

        case WStype_ERROR:
            Serial.println("WebSocket error");
            break;

        case WStype_PING:
        case WStype_PONG:
            // Handled automatically
            break;

        default:
            break;
    }
}

static void parsePlayerState(JsonObject& payload) {
    // Check if display object exists
    if (!payload.containsKey("display")) {
        Serial.println("No display in player state");
        return;
    }

    JsonObject display = payload["display"];

    // Parse line1 (use | "" to handle null values)
    JsonObject line1 = display["line1"];
    currentDisplayState.line1.left = line1["left"] | "";
    currentDisplayState.line1.right = line1["right"] | "";

    // Parse line2
    JsonObject line2 = display["line2"];
    currentDisplayState.line2.text = line2["text"] | "";
    currentDisplayState.line2.style = parseDisplayStyle(line2["style"] | "normal");

    // Parse line3 (supports centered text, left/right, and left/center/right)
    JsonObject line3 = display["line3"];
    currentDisplayState.line3.text = line3["text"] | "";
    currentDisplayState.line3.left = line3["left"] | "";
    currentDisplayState.line3.center = line3["center"] | "";
    currentDisplayState.line3.right = line3["right"] | "";

    // Parse LEDs
    JsonObject leds = display["leds"];
    currentDisplayState.leds.yes = parseLedState(leds["yes"] | "off");
    currentDisplayState.leds.no = parseLedState(leds["no"] | "off");

    // Parse status LED (neopixel game state)
    currentDisplayState.statusLed = parseGameLedState(display["statusLed"] | "");

    // Notify callback
    if (displayCallback != nullptr) {
        displayCallback(currentDisplayState);
    }
}
