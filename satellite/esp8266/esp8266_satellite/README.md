# Makerspace ESP8266 Satellite Controller

This firmware allows an ESP8266 satellite controller to communicate with the Makerspace server over Wi-Fi using HTTP requests.

## Hardware

- ESP8266 development board (LOLIN/WEMOS D1 mini compatible)
- USB cable for programming and power
- Wi-Fi network

## Software Requirements

- Arduino IDE
- ESP8266 Arduino Core 3.1.2
- ArduinoJson library 7.4.3
- ESP8266WiFi and ESP8266WebServer libraries (included with the ESP8266 board package)

Select **LOLIN(WEMOS) D1 R2 & mini** in Arduino IDE.

## Configuration

1. Copy `secrets.example.h` to `secrets.h`.
2. Enter your Wi-Fi SSID and password.
3. Generate a random API key and assign it to `COMMAND_API_KEY`.
4. Keep `secrets.h` private. It must not be committed to Git.
5. Compile and upload `esp8266_satellite.ino` using Arduino IDE.
6. Open Serial Monitor at 115200 baud to find the ESP8266 IP address.

## API Endpoints

### GET /status

Returns the satellite's current status.

Example response:

```json
{
  "status": "online",
  "device": "makerspace-satellite"
}
```

### POST /command

Accepts an authenticated JSON command.

Required headers:

- `Content-Type: application/json`
- `X-API-Key: <configured API key>`

Example request body:

```json
{
  "command": "PING"
}
```

Successful response:

```json
{
  "success": true,
  "message": "PING received"
}
```

Possible errors:

- `400 Bad Request` — Invalid JSON, missing command, or unsupported command
- `401 Unauthorized` — Missing or incorrect API key
- `404 Not Found` — Unknown endpoint

## Testing

Use `curl` or the Makerspace TypeScript service to send requests to the ESP8266.

Replace the example IP address with the one displayed in Serial Monitor.

To test the status endpoint:

```bash
curl http://192.168.0.169/status
```

To test that unauthorized commands are rejected:

```bash
curl -i -X POST http://192.168.0.169/command \
  -H "Content-Type: application/json" \
  -d '{"command":"PING"}'
```

Expected result: `401 Unauthorized`.

For authorized commands, provide the API key through the `X-API-Key` header without storing it in source code or shell history.

## Security and Limitations

- Only the harmless `PING` command is currently supported.
- API-key authentication protects the command endpoint from requests without the shared secret.
- Communication uses unencrypted HTTP, so the API key and messages may be visible to others on the network.
- This prototype is intended for development on a trusted local network.
- Do not expose the device to the public internet or connect it to machinery until stronger security and safety controls are implemented.