
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ArduinoJson.h>

#include "secrets.h"

ESP8266WebServer server(80);

// LED pins
const int ONLINE_LED = D5;
const int CHECKOUT_LED = D6;
const int MAINTENANCE_LED = D7;

// Machine status
bool machineCheckedOut = false;
bool machineMaintenance = false;
bool serverStarted = false;

// Update all three status LEDs
void updateLEDs() {
  bool online = (WiFi.status() == WL_CONNECTED) && serverStarted;

  digitalWrite(ONLINE_LED, online ? HIGH : LOW);
  digitalWrite(CHECKOUT_LED,
               machineCheckedOut && !machineMaintenance ? HIGH : LOW);
  digitalWrite(MAINTENANCE_LED, machineMaintenance ? HIGH : LOW);
}

void handleStatus() {
  JsonDocument doc;

  doc["status"] = "online";
  doc["device"] = "makerspace-satellite";
  doc["checked_out"] = machineCheckedOut;
  doc["maintenance"] = machineMaintenance;

  String response;
  serializeJson(doc, response);

  server.send(200, "application/json", response);
}

void handleNotFound() {
  server.send(
    404,
    "application/json",
    "{\"error\":\"not_found\"}"
  );
}

void handleCommand() {
  // Authenticate the command
  if (!server.hasHeader("X-API-Key") ||
      server.header("X-API-Key") != COMMAND_API_KEY) {
    server.send(
      401,
      "application/json",
      "{\"success\":false,\"error\":\"unauthorized\"}"
    );
    return;
  }

  // Check the request body
  if (!server.hasArg("plain")) {
    server.send(
      400,
      "application/json",
      "{\"success\":false,\"error\":\"missing_body\"}"
    );
    return;
  }

  JsonDocument doc;
  DeserializationError error =
      deserializeJson(doc, server.arg("plain"));

  if (error) {
    server.send(
      400,
      "application/json",
      "{\"success\":false,\"error\":\"invalid_json\"}"
    );
    return;
  }

  if (!doc["command"].is<const char*>()) {
    server.send(
      400,
      "application/json",
      "{\"success\":false,\"error\":\"missing_or_invalid_command\"}"
    );
    return;
  }

  const char* command = doc["command"].as<const char*>();

  // Existing PING command
  if (strcmp(command, "PING") == 0) {
    Serial.println("Command received: PING");

    server.send(
      200,
      "application/json",
      "{\"success\":true,\"message\":\"PING received\"}"
    );
    return;
  }

  // Update checkout indicator
  if (strcmp(command, "SET_CHECKOUT") == 0) {
    if (!doc["enabled"].is<bool>()) {
      server.send(
        400,
        "application/json",
        "{\"success\":false,\"error\":\"invalid_enabled\"}"
      );
      return;
    }

    bool enabled = doc["enabled"].as<bool>();

    if (enabled && machineMaintenance) {
      server.send(
        409,
        "application/json",
        "{\"success\":false,\"error\":\"maintenance_active\"}"
      );
      return;
    }

    machineCheckedOut = enabled;
    updateLEDs();

    Serial.print("Machine checked out: ");
    Serial.println(machineCheckedOut ? "YES" : "NO");

    server.send(
      200,
      "application/json",
      "{\"success\":true,\"message\":\"Checkout status updated\"}"
    );
    return;
  }

  // Update maintenance indicator
  if (strcmp(command, "SET_MAINTENANCE") == 0) {
    if (!doc["enabled"].is<bool>()) {
      server.send(
        400,
        "application/json",
        "{\"success\":false,\"error\":\"invalid_enabled\"}"
      );
      return;
    }

    machineMaintenance = doc["enabled"].as<bool>();

    // Maintenance takes priority over checkout
    if (machineMaintenance) {
      machineCheckedOut = false;
    }

    updateLEDs();

    Serial.print("Machine maintenance: ");
    Serial.println(machineMaintenance ? "YES" : "NO");

    server.send(
      200,
      "application/json",
      "{\"success\":true,\"message\":\"Maintenance status updated\"}"
    );
    return;
  }

  server.send(
    400,
    "application/json",
    "{\"success\":false,\"error\":\"unsupported_command\"}"
  );
}

void setup() {
  Serial.begin(115200);
  delay(100);

  // Initialize status LEDs
  pinMode(ONLINE_LED, OUTPUT);
  pinMode(CHECKOUT_LED, OUTPUT);
  pinMode(MAINTENANCE_LED, OUTPUT);

  digitalWrite(ONLINE_LED, LOW);
  digitalWrite(CHECKOUT_LED, LOW);
  digitalWrite(MAINTENANCE_LED, LOW);

  Serial.println();
  Serial.println("Makerspace Satellite Controller");
  Serial.println("Connecting to Wi-Fi...");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("Wi-Fi connected.");

  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  server.collectHeaders("X-API-Key");
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/command", HTTP_POST, handleCommand);
  server.onNotFound(handleNotFound);

  server.begin();
  serverStarted = true;

  updateLEDs();

  Serial.println("HTTP server started.");
}

void loop() {
  server.handleClient();
  updateLEDs();

  // Diagnostic: force D6 HIGH
  //digitalWrite(D1, HIGH);
}
