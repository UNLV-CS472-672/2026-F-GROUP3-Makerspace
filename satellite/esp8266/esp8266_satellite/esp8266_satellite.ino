#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>

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

  server.on("/status", HTTP_GET, handleStatus);
  server.onNotFound(handleNotFound);

  server.begin();

  Serial.println("HTTP server started.");
}

void loop() {
  server.handleClient();
}