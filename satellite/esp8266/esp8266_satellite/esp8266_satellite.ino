#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ArduinoJson.h>

#include "secrets.h"

ESP8266WebServer server(80);

void handleStatus() {
  server.send(
    200,
    "application/json",
    "{\"status\":\"online\",\"device\":\"makerspace-satellite\"}"
  );
}

void handleNotFound() {
  server.send(
    404,
    "application/json",
    "{\"error\":\"not_found\"}"
  );
}

void handleCommand() {
    // Reject requests without the correct API key.
  if (!server.hasHeader("X-API-Key") ||
      server.header("X-API-Key") != COMMAND_API_KEY) {
    server.send(
      401,
      "application/json",
      "{\"success\":false,\"error\":\"unauthorized\"}"
    );
    return;
  }
  // Check whether the request contains a body.
  if (!server.hasArg("plain")) {
    server.send(
      400,
      "application/json",
      "{\"success\":false,\"error\":\"missing_body\"}"
    );
    return;
  }

  // Parse the JSON request body.
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, server.arg("plain"));

  if (error) {
    server.send(
      400,
      "application/json",
      "{\"success\":false,\"error\":\"invalid_json\"}"
    );
    return;
  }

  // Verify that the command is a string.
  if (!doc["command"].is<const char*>()) {
    server.send(
      400,
      "application/json",
      "{\"success\":false,\"error\":\"missing_or_invalid_command\"}"
    );
    return;
  }

  const char* command = doc["command"].as<const char*>();

  // Process the supported PING command.
  if (strcmp(command, "PING") == 0) {
    Serial.println("Command received: PING");

    server.send(
      200,
      "application/json",
      "{\"success\":true,\"message\":\"PING received\"}"
    );
  } else {
    server.send(
      400,
      "application/json",
      "{\"success\":false,\"error\":\"unsupported_command\"}"
    );
  }
}

void setup() {
  Serial.begin(115200);
  delay(100);

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

  Serial.println("HTTP server started.");
}

void loop() {
  server.handleClient();
}