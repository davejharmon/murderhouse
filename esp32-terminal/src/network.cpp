// Network Layer Implementation
#include "network.h"
#include "config.h"
#include "display.h"
#include "heartrate.h"
#include <WiFi.h>
#include <WiFiUdp.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <esp_ota_ops.h>
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

// Operator mode (set before init)
static bool isOperatorMode = false;
static bool operatorReady = false;

// Operator flat word list: all words sorted A-Z (deduplicated across categories)
struct OpWord { const char* word; };
static const OpWord OP_FLAT[] = {
    {"A"},{"AGAIN"},{"ALREADY"},{"ALL"},{"ALONE"},{"ALWAYS"},{"AN"},{"AND"},{"ANGRY"},{"ANYWAY"},
    {"BEWARE"},{"BLESSED"},{"BRAVE"},{"BUT"},{"BYE"},
    {"CHANGES"},{"CHOSE"},{"CLEVER"},{"COWARDLY"},{"CRAZY"},
    {"DARK"},{"DAVE"},{"DAY"},{"DID"},{"DIE"},{"DOES"},
    {"ENDS"},{"EVEN"},{"EVIL"},
    {"FAKE"},{"FEARS"},{"FINALLY"},{"FIRST"},{"FORGET"},
    {"GOOD"},{"GUILTY"},
    {"HAS"},{"HATES"},{"HAVE"},{"HE"},{"HEARD"},{"HELLO"},{"HELP"},{"HER"},{"HIDES"},{"HIS"},{"HONESTLY"},{"HUNTS"},
    {"I"},{"IGNORE"},{"INNOCENT"},{"IS"},{"IT"},
    {"JUST"},
    {"KILL"},{"KILLED"},{"KILLER"},{"KIND"},{"KNOWS"},
    {"LAST"},{"LATE"},{"LEFT"},{"LIAR"},{"LIED"},{"LIES"},{"LISTEN"},{"LIVE"},{"LOSE"},{"LOST"},{"LOUD"},{"LUCKY"},{"LYING"},
    {"MAYBE"},{"MEAN"},{"MY"},
    {"NEVER"},{"NEXT"},{"NIGHT"},{"NO"},{"NONE"},{"NOT"},
    {"OBVIOUS"},{"OBVIOUSLY"},{"ONE"},{"ONLY"},{"OOPS"},{"OR"},
    {"PROTECTS"},
    {"QUIET"},
    {"REAL"},{"RED"},{"REMEMBER"},{"RIGHT"},{"RIP"},
    {"SAFE"},{"SAVED"},{"SAW"},{"SCARED"},{"SHE"},{"SHOUTY"},{"SO"},{"SOON"},{"SORRY"},{"STARTS"},{"STILL"},{"STRANGE"},{"STUPID"},{"SUSPECT"},
    {"TEAM"},{"THANKS"},{"THAT"},{"THE"},{"THEM"},{"THEY"},{"THIS"},{"TOLD"},{"TOO"},{"TOWN"},{"TRUE"},{"TRUST"},{"TRUSTS"},{"TRUTH"},
    {"UNLUCKY"},{"US"},
    {"VOTE"},{"VOTED"},
    {"WANTS"},{"WARNED"},{"WATCH"},{"WAS"},{"WE"},{"WELP"},{"WERE"},{"WHOOPS"},{"WILL"},{"WIN"},{"WOLF"},{"WRONG"},
    {"YES"},{"YIKES"},{"YOU"},{"YOUR"},
};
static const int OP_FLAT_SIZE = 142;

// Operator selection state (single flat dial position)
static int operatorFlatIdx = 0;

// Operator built state (from server)
static String operatorBuiltMsg  = "";
static String operatorLastWord  = "";  // last committed word, for NO jump
static int    operatorWordCount = 0;

// Operator "SENT!" feedback timer (0 = inactive)
static unsigned long operatorSentTime = 0;

// Connection state
static ConnectionState connState = ConnectionState::BOOT;
static bool wsConnected = false;
static bool gameJoined = false;
static unsigned long lastReconnectAttempt = 0;
static char lastError[128] = "";

// OTA update flag — set by WebSocket handler, executed from main loop
static bool otaRequested = false;

// Kicked flag — set by server KICKED message, causes terminal to return to player select
static bool wasKicked = false;

// Display state callback
static DisplayStateCallback displayCallback = nullptr;

// Current display state
static DisplayState currentDisplayState;

// Forward declarations
static void onWebSocketEvent(WStype_t type, uint8_t* payload, size_t length);
static void parsePlayerState(JsonObject& payload);
static void parseOperatorState(JsonObject& payload);
static void sendMessage(const char* type, JsonObject* payload = nullptr);
static void updateOperatorDisplay();

// Return the A-Z range label for the given word's first letter
static const char* getRangeLabel(const char* word) {
    char c = word[0];
    if (c <= 'C') return "A-C";
    if (c <= 'H') return "D-H";
    if (c <= 'M') return "I-M";
    if (c <= 'S') return "N-S";
    return "T-Z";
}

static void updateOperatorDisplay() {
    // Show "SENT!" briefly after a slide was dispatched (matches React Operator UX)
    if (operatorSentTime > 0 && millis() - operatorSentTime < 2000) {
        DisplayState state;
        state.line2.text  = "SENT!";
        state.line2.style = DisplayStyle::CRITICAL;
        state.leds.yes    = LedState::OFF;
        state.leds.no     = LedState::OFF;
        state.statusLed   = GameLedState::NONE;
        if (displayCallback != nullptr) displayCallback(state);
        return;
    }

    DisplayState state;
    const OpWord& entry = OP_FLAT[operatorFlatIdx];

    // line1.left = committed sentence, line1.right = alphabetical range label when not ready
    state.line1.left  = operatorBuiltMsg;
    state.line1.right = operatorReady ? "" : getRangeLabel(entry.word);

    // line2 carries preview word and triggers operator rendering mode
    state.line2.text  = operatorReady ? "" : entry.word;
    state.line2.style = DisplayStyle::OPERATOR;

    // Tick in icon slot 2 when ready
    state.icons[2].id    = operatorReady ? "op_tick" : "empty";
    state.icons[2].state = operatorReady ? IconState::ACTIVE : IconState::EMPTY;

    // Button LEDs
    state.leds.yes = operatorReady ? LedState::OFF : LedState::BRIGHT;
    state.leds.no  = (operatorWordCount > 0 || operatorReady) ? LedState::BRIGHT : LedState::OFF;
    state.statusLed = GameLedState::NONE;

    if (displayCallback != nullptr) {
        displayCallback(state);
    }
}

void networkSetPlayerId(uint8_t playerNum) {
    // Use just the number to match the web client format
    snprintf(playerId, sizeof(playerId), "%d", playerNum);
    isOperatorMode = false;
    Serial.print("Player ID set to: ");
    Serial.println(playerId);
}

void networkSetOperatorMode() {
    isOperatorMode = true;
    playerId[0] = '\0';
    Serial.println("Operator mode set");
}

bool networkIsOperatorMode() {
    return isOperatorMode;
}

bool networkIsOperatorReady() {
    return operatorReady;
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

// Compare semver strings: returns true if remote > local
static bool isNewerVersion(const char* remote, const char* local) {
    int rMaj = 0, rMin = 0, rPat = 0;
    int lMaj = 0, lMin = 0, lPat = 0;
    sscanf(remote, "%d.%d.%d", &rMaj, &rMin, &rPat);
    sscanf(local, "%d.%d.%d", &lMaj, &lMin, &lPat);
    if (rMaj != lMaj) return rMaj > lMaj;
    if (rMin != lMin) return rMin > lMin;
    return rPat > lPat;
}

// Check server for firmware update; download and apply if newer version available.
// Called once after server discovery, before WebSocket connection.
static void checkFirmwareUpdate(const char* host, uint16_t port) {
    Serial.println("[OTA] Checking for firmware update...");

    // 1. Fetch version manifest
    HTTPClient http;
    char url[128];
    snprintf(url, sizeof(url), "http://%s:%d/firmware/version", host, port);
    Serial.printf("[OTA] Fetching %s\n", url);
    http.begin(String(url));
    http.setTimeout(5000);
    int httpCode = http.GET();
    Serial.printf("[OTA] HTTP response: %d\n", httpCode);

    if (httpCode != 200) {
        Serial.printf("[OTA] Version check failed (HTTP %d), skipping\n", httpCode);
        http.end();
        return;
    }

    String body = http.getString();
    http.end();

    StaticJsonDocument<128> doc;
    if (deserializeJson(doc, body)) {
        Serial.println("[OTA] Failed to parse version JSON, skipping");
        return;
    }

    const char* remoteVersion = doc["version"] | "0.0.0";
    Serial.printf("[OTA] Local: %s, Server: %s\n", FIRMWARE_VERSION, remoteVersion);

    if (!isNewerVersion(remoteVersion, FIRMWARE_VERSION)) {
        Serial.println("[OTA] Firmware is up to date");
        return;
    }

    // 2. Log partition info for debugging
    const esp_partition_t* running = esp_ota_get_running_partition();
    const esp_partition_t* target = esp_ota_get_next_update_partition(NULL);
    Serial.printf("[OTA] Running partition: %s (0x%06x)\n", running ? running->label : "?", running ? running->address : 0);
    Serial.printf("[OTA] Target partition:  %s (0x%06x, size 0x%06x)\n",
        target ? target->label : "?", target ? target->address : 0, target ? target->size : 0);

    // 3. Log heap state for debugging
    Serial.printf("[OTA] Free heap: %d, largest block: %d\n",
        ESP.getFreeHeap(), heap_caps_get_largest_free_block(MALLOC_CAP_DEFAULT));

    // 4. Disconnect WebSocket before OTA — frees RAM and prevents WiFi stack
    //    contention between WebSocket frames and HTTP download
    Serial.println("[OTA] Disconnecting WebSocket for clean OTA...");
    webSocket.disconnect();
    wsConnected = false;
    gameJoined = false;

    // 5. Stagger downloads — random delay so multiple terminals don't hit
    //    the server simultaneously (causes corrupt transfers)
    int staggerMs = random(100, 3000);
    Serial.printf("[OTA] Staggering %d ms...\n", staggerMs);
    delay(staggerMs);

    // 6. Download and flash
    Serial.printf("[OTA] Updating to %s...\n", remoteVersion);
    displayMessage("OTA UPDATE", remoteVersion, "Downloading...");

    snprintf(url, sizeof(url), "http://%s:%d/firmware/firmware.bin", host, port);
    Serial.printf("[OTA] Downloading %s\n", url);

    WiFiClient client;
    httpUpdate.setLedPin(-1);  // No LED
    httpUpdate.rebootOnUpdate(false);  // We handle reboot manually
    t_httpUpdate_return ret = httpUpdate.update(client, String(url));

    switch (ret) {
        case HTTP_UPDATE_OK:
            Serial.println("[OTA] Update successful! Rebooting...");
            displayMessage("OTA UPDATE", "SUCCESS", "Rebooting...");
            delay(500);
            ESP.restart();
            break;
        case HTTP_UPDATE_FAILED:
            Serial.printf("[OTA] Failed (err %d): %s\n",
                httpUpdate.getLastError(), httpUpdate.getLastErrorString().c_str());
            displayMessage("OTA UPDATE", "FAILED", httpUpdate.getLastErrorString().c_str());
            delay(3000);
            break;
        case HTTP_UPDATE_NO_UPDATES:
            Serial.println("[OTA] No update needed");
            break;
    }
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
                if (isOperatorMode) {
                    sendMessage(ClientMsg::OPERATOR_JOIN);
                } else {
                    StaticJsonDocument<128> doc;
                    doc["playerId"] = playerId;
                    doc["source"] = "terminal";
                    doc["firmwareVersion"] = FIRMWARE_VERSION;
                    JsonObject payload = doc.as<JsonObject>();
                    sendMessage(ClientMsg::JOIN, &payload);
                }
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
                // Always use JOIN — server-side JOIN handler already checks for
                // existing players and reconnects them. REJOIN was fragile
                // (double-error race, fallback flag issues on server restart).
                if (isOperatorMode) {
                    sendMessage(ClientMsg::OPERATOR_JOIN);
                } else {
                    StaticJsonDocument<128> doc;
                    doc["playerId"] = playerId;
                    doc["source"] = "terminal";
                    doc["firmwareVersion"] = FIRMWARE_VERSION;
                    JsonObject payload = doc.as<JsonObject>();
                    sendMessage(ClientMsg::JOIN, &payload);
                }
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
    if (connState == ConnectionState::ERROR || connState == ConnectionState::RECONNECTING) {
        Serial.println("Retrying join...");
        lastError[0] = '\0';  // Clear error message

        if (wsConnected) {
            if (isOperatorMode) {
                sendMessage(ClientMsg::OPERATOR_JOIN);
            } else {
                StaticJsonDocument<128> doc;
                doc["playerId"] = playerId;
                doc["source"] = "terminal";
                doc["firmwareVersion"] = FIRMWARE_VERSION;
                JsonObject payload = doc.as<JsonObject>();
                sendMessage(ClientMsg::JOIN, &payload);
            }
            connState = ConnectionState::JOINING;
        } else {
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

void networkSendSelectTo(const char* targetId) {
    if (networkIsConnected()) {
        StaticJsonDocument<128> doc;
        doc["targetId"] = targetId;
        JsonObject payload = doc.as<JsonObject>();
        sendMessage(ClientMsg::SELECT_TO, &payload);
    }
}

void networkSendConfirm() {
    if (networkIsConnected()) {
        sendMessage(ClientMsg::CONFIRM);
    }
}

void networkSendConfirmWithTarget(const char* targetId) {
    if (networkIsConnected()) {
        StaticJsonDocument<128> doc;
        doc["targetId"] = targetId;
        JsonObject payload = doc.as<JsonObject>();
        sendMessage(ClientMsg::CONFIRM, &payload);
    }
}

void networkSendAbstain() {
    if (networkIsConnected()) {
        sendMessage(ClientMsg::ABSTAIN);
    }
}

void networkSendIdleScrollUp() {
    if (networkIsConnected()) {
        sendMessage(ClientMsg::IDLE_SCROLL_UP);
    }
}

void networkSendIdleScrollDown() {
    if (networkIsConnected()) {
        sendMessage(ClientMsg::IDLE_SCROLL_DOWN);
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

void networkSendHeartbeat(uint8_t bpm) {
    if (networkIsConnected()) {
        StaticJsonDocument<128> doc;
        doc["bpm"] = bpm;
        JsonObject payload = doc.as<JsonObject>();
        sendMessage(ClientMsg::HEARTBEAT, &payload);
    }
}

const char* networkGetLastError() {
    return lastError;
}

bool networkWasKicked() {
    if (wasKicked) {
        wasKicked = false;
        return true;
    }
    return false;
}

bool networkOtaRequested() {
    return otaRequested;
}

void networkExecuteOta() {
    otaRequested = false;
    checkFirmwareUpdate(serverHost, serverPort);
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
            StaticJsonDocument<4096> doc;
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
                if (connState == ConnectionState::JOINING) {
                    connState = ConnectionState::ERROR;
                }
            }
            else if (strcmp(msgType, ServerMsg::PLAYER_STATE) == 0) {
                parsePlayerState(msgPayload);
            }
            else if (strcmp(msgType, ServerMsg::OPERATOR_STATE) == 0) {
                parseOperatorState(msgPayload);
            }
            else if (strcmp(msgType, ServerMsg::HEARTRATE_MONITOR) == 0) {
                bool enabled = msgPayload["enabled"] | false;
                if (enabled) {
                    heartrateEnable();
                } else {
                    heartrateDisable();
                }
            }
            else if (strcmp(msgType, ServerMsg::UPDATE_FIRMWARE) == 0) {
                Serial.println("[OTA] Server requested firmware update");
                otaRequested = true;
            }
            else if (strcmp(msgType, ServerMsg::KICKED) == 0) {
                Serial.println("Kicked by server — returning to player select");
                wasKicked = true;
            }
            else if (strcmp(msgType, ServerMsg::GAME_STATE) == 0) {
                // Ignored by terminal — display is server-driven via PLAYER_STATE
            }
            else if (strcmp(msgType, ServerMsg::EVENT_PROMPT) == 0) {
                // Ignored by terminal
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

    // Parse icon column
    if (display.containsKey("icons")) {
        JsonArray iconsArr = display["icons"];
        for (int i = 0; i < 3 && i < (int)iconsArr.size(); i++) {
            JsonObject icon = iconsArr[i];
            currentDisplayState.icons[i].id = icon["id"] | "empty";
            currentDisplayState.icons[i].state = parseIconState(icon["state"] | "empty");
        }
    }
    currentDisplayState.idleScrollIndex = display["idleScrollIndex"] | 0;

    // Parse target list for local scrolling and accurate confirm
    currentDisplayState.targetCount = 0;
    currentDisplayState.selectionIndex = display["selectionIndex"] | -1;
    if (display.containsKey("targetNames")) {
        JsonArray namesArr = display["targetNames"];
        JsonArray idsArr   = display["targetIds"];
        for (int i = 0; i < DisplayState::MAX_TARGETS && i < (int)namesArr.size(); i++) {
            currentDisplayState.targetNames[i] = namesArr[i].as<String>();
            if (!idsArr.isNull() && i < (int)idsArr.size()) {
                currentDisplayState.targetIds[i] = idsArr[i].as<String>();
            }
            currentDisplayState.targetCount++;
        }
    }

    // Notify callback
    if (displayCallback != nullptr) {
        displayCallback(currentDisplayState);
    }
}

static void parseOperatorState(JsonObject& payload) {
    bool wasReady = operatorReady;
    operatorReady = payload["ready"] | false;

    // Update built message from server state
    operatorBuiltMsg  = "";
    operatorLastWord  = "";
    operatorWordCount = 0;
    JsonArray words = payload["words"];
    if (!words.isNull()) {
        for (JsonVariant word : words) {
            if (operatorWordCount > 0) operatorBuiltMsg += " ";
            String w = word.as<String>();
            operatorBuiltMsg += w;
            operatorLastWord  = w;   // keep overwriting to capture last
            operatorWordCount++;
        }
    }

    // Reset dial and show "SENT!" when a slide was dispatched (was ready → now empty)
    if (wasReady && operatorWordCount == 0 && !operatorReady) {
        operatorFlatIdx = 0;
        operatorSentTime = millis();
    }

    updateOperatorDisplay();
}

// Call each loop iteration to clear the "SENT!" screen after 2 seconds
void networkOperatorTick() {
    if (operatorSentTime > 0 && millis() - operatorSentTime >= 2000) {
        operatorSentTime = 0;
        updateOperatorDisplay();
    }
}

void networkOperatorScrollDown() {
    operatorFlatIdx = (operatorFlatIdx + 1) % OP_FLAT_SIZE;
    updateOperatorDisplay();
}

void networkOperatorScrollUp() {
    operatorFlatIdx = (operatorFlatIdx - 1 + OP_FLAT_SIZE) % OP_FLAT_SIZE;
    updateOperatorDisplay();
}

void networkSendOperatorAdd() {
    if (networkIsConnected()) {
        const char* word = OP_FLAT[operatorFlatIdx].word;
        StaticJsonDocument<64> doc;
        doc["word"] = word;
        JsonObject payload = doc.as<JsonObject>();
        sendMessage(ClientMsg::OPERATOR_ADD, &payload);
    }
}

void networkSendOperatorReady() {
    if (networkIsConnected() && operatorWordCount > 0) {
        sendMessage(ClientMsg::OPERATOR_READY);
    }
}

void networkSendOperatorUnready() {
    if (networkIsConnected()) {
        sendMessage(ClientMsg::OPERATOR_UNREADY);
    }
}

void networkSendOperatorClear() {
    operatorFlatIdx = 0;
    updateOperatorDisplay();
    if (networkIsConnected()) {
        sendMessage(ClientMsg::OPERATOR_CLEAR);
    }
}

void networkSendOperatorDelete() {
    // Jump dial to the position of the last committed word before deleting
    if (operatorWordCount > 0) {
        for (int i = 0; i < OP_FLAT_SIZE; i++) {
            if (operatorLastWord == OP_FLAT[i].word) {
                operatorFlatIdx = i;
                break;
            }
        }
    }
    updateOperatorDisplay();
    if (networkIsConnected()) {
        sendMessage(ClientMsg::OPERATOR_DELETE);
    }
}
