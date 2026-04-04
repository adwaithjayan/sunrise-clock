#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <ESPmDNS.h>
#include <Update.h>
#include <Preferences.h>
#include <FastLED.h>
#include <Wire.h>
#include <RTClib.h>
#include <time.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ─── Firmware version ────────────────────────────────────────────────────────
#define FIRMWARE_VERSION "v0.1.0"

// ─── GitHub OTA ──────────────────────────────────────────────────────────────
#define GITHUB_USER    "adwaithjayan"
#define GITHUB_REPO    "sunrise-clock"
#define GITHUB_API     "https://api.github.com/repos/" GITHUB_USER "/" GITHUB_REPO "/releases/latest"

// ─── Default device name ─────────────────────────────────────────────────────
#define DEFAULT_DEVICE_NAME "Sunrise-Clock"

// ─── AP credentials (setup portal) ───────────────────────────────────────────
#define AP_SSID     "Sunrise-Clock-Setup"
#define AP_PASSWORD "12345678"

// ─── LED config ──────────────────────────────────────────────────────────────
#define LED_PIN     12
#define NUM_LEDS    34
#define LED_TYPE    WS2812B
#define COLOR_ORDER GRB

CRGB leds[NUM_LEDS];

#define IND_AMPM    0
#define IND_WIFI    1
#define IND_BATTERY 2
#define IND_ALARM   3

// ─── BLE ─────────────────────────────────────────────────────────────────────
#define BLE_SERVICE_UUID    "12345678-1234-1234-1234-123456789abc"
#define BLE_CHAR_UUID       "abcd1234-ab12-ab12-ab12-abcdef123456"

int digit1Map[7] = {8,  7,  6,  5,  4,  9,  10};
int digit2Map[7] = {15, 14, 13, 12, 11, 16, 17};
int digit3Map[7] = {24, 23, 22, 21, 20, 25, 26};
int digit4Map[7] = {31, 30, 29, 28, 27, 32, 33};
int colonLEDs[2] = {18, 19};

bool digits[10][7] = {
  {1,1,1,1,1,1,0}, // 0
  {0,1,1,0,0,0,0}, // 1
  {1,1,0,1,1,0,1}, // 2
  {1,1,1,1,0,0,1}, // 3
  {0,1,1,0,0,1,1}, // 4
  {1,0,1,1,0,1,1}, // 5
  {1,0,1,1,1,1,1}, // 6
  {1,1,1,0,0,0,0}, // 7
  {1,1,1,1,1,1,1}, // 8
  {1,1,1,1,0,1,1}  // 9
};

// ─── Globals ─────────────────────────────────────────────────────────────────
WebServer        server(80);
WebSocketsServer ws(81);
Preferences      prefs;
RTC_DS3231       rtc;

String deviceName   = DEFAULT_DEVICE_NAME;
bool   colonVisible = true;
CRGB   clockColor   = CRGB(255, 140, 0);
unsigned long lastColonToggle = 0;
unsigned long lastNTP         = 0;
bool   apMode = false;

// ─── LED helpers ─────────────────────────────────────────────────────────────
void showDigit(int* segMap, int num, CRGB color) {
  for (int s = 0; s < 7; s++)
    leds[segMap[s]] = digits[num][s] ? color : CRGB::Black;
}

void displayTime(int h, int m, CRGB color) {
  showDigit(digit1Map, h / 10, color);
  showDigit(digit2Map, h % 10, color);
  showDigit(digit3Map, m / 10, color);
  showDigit(digit4Map, m % 10, color);
  leds[colonLEDs[0]] = colonVisible ? color : CRGB::Black;
  leds[colonLEDs[1]] = colonVisible ? color : CRGB::Black;
  FastLED.show();
}

void setIndicator(int idx, CRGB color) {
  leds[idx] = color;
  FastLED.show();
}

String buildLedStateJson() {
  String json = "[";
  for (int i = 0; i < NUM_LEDS; i++) {
    char buf[24];
    snprintf(buf, sizeof(buf), "[%d,%d,%d]", leds[i].r, leds[i].g, leds[i].b);
    json += buf;
    if (i < NUM_LEDS - 1) json += ",";
  }
  json += "]";
  return json;
}

// ─── WiFi setup portal HTML ──────────────────────────────────────────────────
// Served at 192.168.4.1 when in AP mode
const char SETUP_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sunrise Clock Setup</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0a0a0a;
      color: #f0f0f0;
      font-family: 'Courier New', monospace;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 16px;
      padding: 28px 24px;
      width: 100%;
      max-width: 400px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    h1 { color: #f59e0b; font-size: 1.3rem; letter-spacing: 0.1em; }
    p.sub { color: #666; font-size: 0.8rem; }
    label { font-size: 0.8rem; color: #aaa; display: block; margin-bottom: 6px; }
    input {
      width: 100%;
      background: #111;
      border: 1px solid #444;
      border-radius: 8px;
      padding: 10px 12px;
      color: #fff;
      font-size: 0.95rem;
      font-family: inherit;
    }
    input:focus { outline: none; border-color: #f59e0b; }
    .networks {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 200px;
      overflow-y: auto;
      padding-right: 4px;
    }
    .networks::-webkit-scrollbar { width: 4px; }
    .networks::-webkit-scrollbar-track { background: #222; border-radius: 4px; }
    .networks::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }
    .network-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #222;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 10px 12px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    .network-item:hover  { background: #2a2a2a; border-color: #f59e0b; }
    .network-item.selected { background: #2a1f00; border-color: #f59e0b; }
    .net-name { font-size: 0.9rem; }
    .net-signal { font-size: 0.75rem; color: #666; }
    .scanning { color: #666; font-size: 0.85rem; text-align: center; padding: 12px; }
    button.primary {
      background: #f59e0b;
      color: #000;
      border: none;
      border-radius: 8px;
      padding: 12px;
      font-size: 0.95rem;
      font-family: inherit;
      font-weight: bold;
      cursor: pointer;
      width: 100%;
      transition: background 0.15s;
    }
    button.primary:hover    { background: #fbbf24; }
    button.primary:disabled { background: #555; color: #888; cursor: not-allowed; }
    button.secondary {
      background: transparent;
      color: #aaa;
      border: 1px solid #444;
      border-radius: 8px;
      padding: 8px;
      font-size: 0.8rem;
      font-family: inherit;
      cursor: pointer;
      width: 100%;
    }
    button.secondary:hover { border-color: #666; color: #ddd; }
    #status { font-size: 0.85rem; text-align: center; min-height: 1.2em; }
    .ok  { color: #4ade80; }
    .err { color: #f87171; }
    .inf { color: #60a5fa; }
  </style>
</head>
<body>
<div class="card">
  <div>
    <h1>🌅 SUNRISE CLOCK</h1>
    <p class="sub">Connect to your WiFi network</p>
  </div>

  <div>
    <label>Available networks</label>
    <div class="networks" id="networks">
      <div class="scanning">Scanning…</div>
    </div>
  </div>

  <div>
    <label for="ssid">Network name (SSID)</label>
    <input id="ssid" type="text" placeholder="Enter or tap network above" autocomplete="off" spellcheck="false">
  </div>

  <div>
    <label for="pass">Password</label>
    <input id="pass" type="password" placeholder="WiFi password" autocomplete="off">
  </div>

  <div id="status"></div>

  <button class="primary" id="connectBtn" onclick="connect()">Connect</button>
  <button class="secondary" onclick="scanNetworks()">Refresh networks</button>
</div>

<script>
  let selectedSsid = "";

  function setStatus(msg, cls) {
    const el = document.getElementById("status");
    el.textContent = msg;
    el.className = cls || "";
  }

  function signalIcon(rssi) {
    if (rssi >= -50) return "▂▄▆█";
    if (rssi >= -65) return "▂▄▆░";
    if (rssi >= -75) return "▂▄░░";
    return "▂░░░";
  }

  async function scanNetworks() {
    document.getElementById("networks").innerHTML = '<div class="scanning">Scanning…</div>';
    try {
      const res  = await fetch("/scan");
      const list = await res.json();
      const container = document.getElementById("networks");
      if (!list.length) {
        container.innerHTML = '<div class="scanning">No networks found</div>';
        return;
      }
      container.innerHTML = "";
      list.forEach(net => {
        const div = document.createElement("div");
        div.className = "network-item" + (net.ssid === selectedSsid ? " selected" : "");
        div.innerHTML = `
          <span class="net-name">${net.ssid}</span>
          <span class="net-signal">${signalIcon(net.rssi)} ${net.rssi}dBm${net.enc ? " 🔒" : ""}</span>
        `;
        div.onclick = () => {
          document.querySelectorAll(".network-item").forEach(el => el.classList.remove("selected"));
          div.classList.add("selected");
          selectedSsid = net.ssid;
          document.getElementById("ssid").value = net.ssid;
          document.getElementById("pass").focus();
        };
        container.appendChild(div);
      });
    } catch {
      document.getElementById("networks").innerHTML = '<div class="scanning">Scan failed</div>';
    }
  }

  async function connect() {
    const ssid = document.getElementById("ssid").value.trim();
    const pass = document.getElementById("pass").value;
    if (!ssid) { setStatus("Enter a network name", "err"); return; }

    const btn = document.getElementById("connectBtn");
    btn.disabled = true;
    setStatus("Connecting…", "inf");

    try {
      const res  = await fetch("/connect", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ssid, pass }),
      });
      const data = await res.json();
      if (data.status === "ok") {
        setStatus("Connected! Clock is restarting…", "ok");
      } else {
        setStatus("Failed — wrong password?", "err");
        btn.disabled = false;
      }
    } catch {
      setStatus("Error — try again", "err");
      btn.disabled = false;
    }
  }

  // Scan on page load
  scanNetworks();
</script>
</body>
</html>
)rawliteral";

// ─── AP mode — WiFi setup portal ─────────────────────────────────────────────
void startAPMode() {
  apMode = true;
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASSWORD);

  Serial.println("AP mode started");
  Serial.print("Portal at: ");
  Serial.println(WiFi.softAPIP());

  // Blue indicator = AP/setup mode
  setIndicator(IND_WIFI, CRGB::Blue);

  // Serve setup page
  server.on("/", HTTP_GET, []() {
    server.send_P(200, "text/html", SETUP_HTML);
  });

  // Scan available networks — returns JSON array
  server.on("/scan", HTTP_GET, []() {
    int n = WiFi.scanNetworks();
    String json = "[";
    for (int i = 0; i < n; i++) {
      if (i > 0) json += ",";
      bool enc = (WiFi.encryptionType(i) != WIFI_AUTH_OPEN);
      json += "{\"ssid\":\"" + WiFi.SSID(i) + "\","
              "\"rssi\":"   + WiFi.RSSI(i)  + ","
              "\"enc\":"    + (enc ? "true" : "false") + "}";
    }
    json += "]";
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "application/json", json);
  });

  // Receive credentials, try to connect, save if success
  server.on("/connect", HTTP_POST, []() {
    if (!server.hasArg("plain")) { server.send(400); return; }
    StaticJsonDocument<256> doc;
    deserializeJson(doc, server.arg("plain"));
    String ssid = doc["ssid"].as<String>();
    String pass = doc["pass"].as<String>();

    // Try connecting with provided credentials
    WiFi.mode(WIFI_AP_STA);
    WiFi.begin(ssid.c_str(), pass.c_str());

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
      delay(500);
      attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
      // Save to flash
      prefs.begin("clock", false);
      prefs.putString("ssid", ssid);
      prefs.putString("pass", pass);
      prefs.end();

      server.sendHeader("Access-Control-Allow-Origin", "*");
      server.send(200, "application/json", "{\"status\":\"ok\"}");
      delay(1500);
      ESP.restart();
    } else {
      server.sendHeader("Access-Control-Allow-Origin", "*");
      server.send(200, "application/json", "{\"status\":\"fail\"}");
      // Go back to pure AP mode
      WiFi.mode(WIFI_AP);
    }
  });

  server.begin();
}

// ─── Normal WiFi connect (uses saved credentials) ────────────────────────────
bool connectWiFi() {
  prefs.begin("clock", true);
  String ssid = prefs.getString("ssid", "");
  String pass = prefs.getString("pass", "");
  prefs.end();

  if (ssid.isEmpty()) return false;

  setIndicator(IND_WIFI, CRGB::Yellow);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), pass.c_str());

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    setIndicator(IND_WIFI, CRGB::Green);
    configTime(19800, 0, "pool.ntp.org"); // IST UTC+5:30
    return true;
  }

  setIndicator(IND_WIFI, CRGB::Red);
  return false;
}

// ─── NTP → RTC sync ──────────────────────────────────────────────────────────
void syncRTCFromNTP() {
  struct tm t;
  if (getLocalTime(&t, 3000)) {
    rtc.adjust(DateTime(
      t.tm_year + 1900, t.tm_mon + 1, t.tm_mday,
      t.tm_hour, t.tm_min, t.tm_sec
    ));
  }
}

// ─── Normal mode HTTP handlers ───────────────────────────────────────────────
void setupNormalRoutes() {

  // GET /discover
  server.on("/discover", HTTP_GET, []() {
    StaticJsonDocument<256> doc;
    doc["name"]    = deviceName;
    doc["version"] = FIRMWARE_VERSION;
    doc["ip"]      = WiFi.localIP().toString();
    doc["mac"]     = WiFi.macAddress();
    String out;
    serializeJson(doc, out);
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "application/json", out);
  });

  // GET /ota/check
  server.on("/ota/check", HTTP_GET, []() {
    if (WiFi.status() != WL_CONNECTED) {
      server.send(503, "application/json", "{\"error\":\"no wifi\"}");
      return;
    }
    HTTPClient http;
    http.begin(GITHUB_API);
    http.addHeader("User-Agent", "ESP32");
    int code = http.GET();
    if (code != 200) {
      server.send(502, "application/json", "{\"error\":\"github unreachable\"}");
      http.end();
      return;
    }
    DynamicJsonDocument doc(4096);
    deserializeJson(doc, http.getString());
    http.end();

    String latestTag  = doc["tag_name"].as<String>();
    String downloadUrl = "";
    for (JsonObject asset : doc["assets"].as<JsonArray>()) {
      String name = asset["name"].as<String>();
      if (name.endsWith(".bin")) {
        downloadUrl = asset["browser_download_url"].as<String>();
        break;
      }
    }

    StaticJsonDocument<256> resp;
    resp["current"] = FIRMWARE_VERSION;
    resp["latest"]  = latestTag;
    resp["update"]  = (latestTag != FIRMWARE_VERSION);
    resp["url"]     = downloadUrl;
    String out;
    serializeJson(resp, out);
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "application/json", out);
  });

  // POST /ota/upload — manual .bin
  server.on("/ota/upload", HTTP_POST,
    []() {
      server.sendHeader("Access-Control-Allow-Origin", "*");
      server.send(200, "application/json",
        Update.hasError() ? "{\"status\":\"fail\"}" : "{\"status\":\"ok\"}");
      delay(500);
      ESP.restart();
    },
    []() {
      HTTPUpload& upload = server.upload();
      if (upload.status == UPLOAD_FILE_START) {
        if (!Update.begin(UPDATE_SIZE_UNKNOWN)) Update.printError(Serial);
      } else if (upload.status == UPLOAD_FILE_WRITE) {
        if (Update.write(upload.buf, upload.currentSize) != upload.currentSize)
          Update.printError(Serial);
        int pct = Update.size() > 0
          ? (Update.progress() * 100) / Update.size() : 0;
        ws.broadcastTXT("{\"type\":\"ota_progress\",\"pct\":" + String(pct) + "}");
      } else if (upload.status == UPLOAD_FILE_END) {
        if (Update.end(true)) Serial.println("OTA manual success");
        else Update.printError(Serial);
      }
    }
  );

  // POST /ota/github
  server.on("/ota/github", HTTP_POST, []() {
    if (!server.hasArg("plain")) { server.send(400); return; }
    StaticJsonDocument<512> doc;
    deserializeJson(doc, server.arg("plain"));
    String url = doc["url"].as<String>();

    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "application/json", "{\"status\":\"started\"}");

    HTTPClient http;
    http.begin(url);
    http.addHeader("User-Agent", "ESP32");
    int code = http.GET();
    if (code == 200) {
      int total       = http.getSize();
      WiFiClient* stream = http.getStreamPtr();
      if (Update.begin(total)) {
        uint8_t buf[1024];
        int written = 0;
        while (http.connected() && written < total) {
          int avail = stream->available();
          if (avail) {
            int toRead = min(avail, 1024);
            stream->readBytes(buf, toRead);
            Update.write(buf, toRead);
            written += toRead;
            int pct = (written * 100) / total;
            ws.broadcastTXT("{\"type\":\"ota_progress\",\"pct\":" + String(pct) + "}");
          }
        }
        if (Update.end(true)) {
          ws.broadcastTXT("{\"type\":\"ota_done\"}");
          delay(500);
          ESP.restart();
        }
      }
    }
    http.end();
  });

  // GET /settings
  server.on("/settings", HTTP_GET, []() {
    StaticJsonDocument<128> doc;
    doc["name"] = deviceName;
    String out;
    serializeJson(doc, out);
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "application/json", out);
  });

  // POST /settings
  server.on("/settings", HTTP_POST, []() {
    if (!server.hasArg("plain")) { server.send(400); return; }
    StaticJsonDocument<128> doc;
    deserializeJson(doc, server.arg("plain"));
    if (doc.containsKey("name")) {
      deviceName = doc["name"].as<String>();
      prefs.begin("clock", false);
      prefs.putString("deviceName", deviceName);
      prefs.end();
    }
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "application/json", "{\"status\":\"ok\"}");
  });



// GET /time
  server.on("/time", HTTP_GET, []() {
    DateTime now = rtc.now();
    StaticJsonDocument<64> doc;
    doc["h"] = now.hour();
    doc["m"] = now.minute();
    doc["s"] = now.second();
    String out;
    serializeJson(doc, out);
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "application/json", out);
  });

  server.on("/time", HTTP_OPTIONS, []() {
    server.sendHeader("Access-Control-Allow-Origin",  "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    server.send(204);
  });

  // POST /color
  server.on("/color", HTTP_POST, []() {
    if (!server.hasArg("plain")) { server.send(400); return; }
    StaticJsonDocument<64> doc;
    deserializeJson(doc, server.arg("plain"));
    int r = doc["r"] | 255;
    int g = doc["g"] | 140;
    int b = doc["b"] | 0;
    clockColor = CRGB(r, g, b);
    String state = "{\"type\":\"led_state\",\"leds\":" + buildLedStateJson() + "}";
    ws.broadcastTXT(state);
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "application/json", "{\"status\":\"ok\"}");
  });

  server.on("/color", HTTP_OPTIONS, []() {
    server.sendHeader("Access-Control-Allow-Origin",  "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    server.send(204);
  });

server.on("/brightness", HTTP_POST, []() {
  if (!server.hasArg("plain")) { server.send(400); return; }
  StaticJsonDocument<64> doc;
  deserializeJson(doc, server.arg("plain"));
  int val = doc["value"] | 80;
  val = constrain(val, 5, 255);
  FastLED.setBrightness(val);
  FastLED.show();
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", "{\"status\":\"ok\"}");
});

server.on("/brightness", HTTP_OPTIONS, []() {
  server.sendHeader("Access-Control-Allow-Origin",  "*");
  server.sendHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.send(204);
});


  // POST /wifi/forget — wipes credentials, reboots to AP mode
  server.on("/wifi/forget", HTTP_POST, []() {
    prefs.begin("clock", false);
    prefs.remove("ssid");
    prefs.remove("pass");
    prefs.end();
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "application/json", "{\"status\":\"ok\"}");
    delay(500);
    ESP.restart();
  });

  // OPTIONS preflight
  const char* routes[] = {
    "/discover", "/ota/check", "/ota/upload",
    "/ota/github", "/settings", "/wifi/forget"
  };
  for (const char* r : routes) {
    server.on(r, HTTP_OPTIONS, []() {
      server.sendHeader("Access-Control-Allow-Origin",  "*");
      server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
      server.send(204);
    });
  }

  server.begin();
}

// ─── WebSocket ────────────────────────────────────────────────────────────────
void onWsEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length) {
  if (type == WStype_CONNECTED) {
    String state = "{\"type\":\"led_state\",\"leds\":" + buildLedStateJson() + "}";
    ws.sendTXT(num, state);
  }
}


void startBLE() {
  BLEDevice::init(deviceName.c_str());
  BLEServer*      bleServer  = BLEDevice::createServer();
  BLEService*     bleService = bleServer->createService(BLE_SERVICE_UUID);
  BLECharacteristic* bleChar = bleService->createCharacteristic(
    BLE_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_NOTIFY
  );
  bleChar->addDescriptor(new BLE2902());

  // Value is JSON: {"name":"Sunrise-Clock","ip":"192.168.1.x","version":"v0.1.0"}
  StaticJsonDocument<128> doc;
  doc["name"]    = deviceName;
  doc["ip"]      = WiFi.localIP().toString();
  doc["version"] = FIRMWARE_VERSION;
  String payload;
  serializeJson(doc, payload);
  bleChar->setValue(payload.c_str());

  bleService->start();
  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(BLE_SERVICE_UUID);
  adv->setScanResponse(true);
  adv->setMinPreferred(0x06);
  BLEDevice::startAdvertising();
  Serial.println("BLE advertising as: " + deviceName);
}

// ─── Setup ───────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  // Load saved device name
  prefs.begin("clock", true);
  String saved = prefs.getString("deviceName", DEFAULT_DEVICE_NAME);
  prefs.end();
  deviceName = saved;

  // LEDs
  FastLED.addLeds<LED_TYPE, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  FastLED.setBrightness(80);
  FastLED.clear();
  FastLED.show();

  // RTC
 Wire.begin(21, 22);
if (!rtc.begin()) {
  Serial.println("RTC not found — using NTP only");
} else {
  rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));  // ← add this
}
  // Try connecting with saved credentials
  bool connected = connectWiFi();

  if (!connected) {
    // No saved credentials or connection failed → open setup portal
    startAPMode();
    return; // loop() will only handle portal server
  }

  // ── Normal mode ──
  delay(1500);
  syncRTCFromNTP();
  MDNS.begin("clock");
  setupNormalRoutes();
  ws.begin();
  ws.onEvent(onWsEvent);

  Serial.println("Ready at http://" + WiFi.localIP().toString());
  startBLE();
}

// ─── Loop ────────────────────────────────────────────────────────────────────
void loop() {
  server.handleClient();

  // In AP mode we only serve the portal — no clock logic
  if (apMode) return;

  ws.loop();

  // Blink colon every second
  if (millis() - lastColonToggle >= 1000) {
    lastColonToggle = millis();
    colonVisible = !colonVisible;
  }

  // NTP re-sync every hour
  if (WiFi.status() == WL_CONNECTED && millis() - lastNTP >= 3600000) {
    lastNTP = millis();
    syncRTCFromNTP();
  }

  // Update display from RTC
  DateTime now = rtc.now();
displayTime(now.hour(), now.minute(), clockColor);
}