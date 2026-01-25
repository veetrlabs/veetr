#include <Arduino.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <vector>
#include <TinyGPS++.h>
#include <Wire.h>
#include <SparkFun_BNO080_Arduino_Library.h>
#include <NimBLEDevice.h>
#include <ModbusMaster.h>
#include <Update.h>
#include <esp_ota_ops.h>

// Firmware version
#define FIRMWARE_VERSION "0.0.28"

// Simple base64 decoding table
const char base64_chars[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// Base64 decode function
int base64_decode(const char* input, uint8_t* output) {
  int input_len = strlen(input);
  if (input_len % 4 != 0) return -1;
  
  int output_len = input_len / 4 * 3;
  if (input[input_len - 1] == '=') output_len--;
  if (input[input_len - 2] == '=') output_len--;
  
  int i, j;
  uint32_t sextet_a, sextet_b, sextet_c, sextet_d;
  uint32_t triple;
  
  for (i = 0, j = 0; i < input_len;) {
    sextet_a = input[i] == '=' ? 0 & i++ : strchr(base64_chars, input[i++]) - base64_chars;
    sextet_b = input[i] == '=' ? 0 & i++ : strchr(base64_chars, input[i++]) - base64_chars;
    sextet_c = input[i] == '=' ? 0 & i++ : strchr(base64_chars, input[i++]) - base64_chars;
    sextet_d = input[i] == '=' ? 0 & i++ : strchr(base64_chars, input[i++]) - base64_chars;
    
    triple = (sextet_a << 3 * 6) + (sextet_b << 2 * 6) + (sextet_c << 1 * 6) + (sextet_d << 0 * 6);
    
    if (j < output_len) output[j++] = (triple >> 2 * 8) & 0xFF;
    if (j < output_len) output[j++] = (triple >> 1 * 8) & 0xFF;
    if (j < output_len) output[j++] = (triple >> 0 * 8) & 0xFF;
  }
  
  return output_len;
}

// Debug flags - uncomment for verbose output
// #define DEBUG_BLE_DATA
#define DEBUG_WIND_SENSOR
// #define DEBUG_GPS
#define DEBUG_BNO080

// Persistent storage for settings
Preferences preferences;
int deadWindAngle = 40; // default
float refreshRateSeconds = 1.0f; // Default 1.0 second refresh rate
bool otaInProgress = false; // Flag to pause sensor data during firmware updates
unsigned long otaStartTime = 0; // Track when OTA started for timeout
unsigned long lastOTAActivity = 0; // Track last OTA activity for debugging
const unsigned long OTA_TIMEOUT_MS = 60000; // 1 minute timeout for OTA updates  
const unsigned long OTA_ACTIVITY_TIMEOUT_MS = 15000; // 15 second activity timeout
const unsigned long OTA_STATUS_INTERVAL_MS = 5000; // Status check every 5 seconds

// BLE Configuration
#define SERVICE_UUID        "12345678-1234-1234-1234-123456789abc"
#define SENSOR_DATA_UUID    "87654321-4321-4321-4321-cba987654321"
#define COMMAND_UUID        "11111111-2222-3333-4444-555555555555"
// Conservatively sized maximum BLE notification payload to avoid MTU fragmentation
// Common Web Bluetooth stacks negotiate MTU ~= 185 bytes (payload ~182). Keep a safe margin.
#define MAX_BLE_PACKET_SIZE 180

NimBLEServer* pServer = NULL;
NimBLECharacteristic* pSensorDataCharacteristic = NULL;
NimBLECharacteristic* pCommandCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;
int bleRSSI = 0; // BLE signal strength
int bleRSSIFiltered = 0; // Smoothed RSSI value for display
uint16_t connectedDeviceCount = 0; // Track number of connected devices
bool bleSending = false; // Prevent concurrent BLE transmissions

// BLE-based OTA update variables
static bool bleOTAActive = false;
static size_t otaWritten = 0;
static size_t otaSize = 0;

// BNO080 IMU Sensor (I2C)
#define BNO080_SDA 21
#define BNO080_SCL 22
BNO080 imu;
bool imuAvailable = false; // Track if IMU is working

// Calibration - simple angle offsets (works for arbitrary mounting orientations)
float rollOffset = 0.0;      // Roll offset when level
float pitchOffset = 0.0;     // Pitch offset when level  
float headingOffset = 0.0;   // Heading offset when pointing north
bool levelCalibrated = false;
bool northCalibrated = false;

// RS485 Wind Sensor Configuration
#define RS485_DE 14
#define RS485_RX 32
#define RS485_TX 33
#define RS485_UART 2

// GPS Module Configuration (using UART1)
#define GPS_RX 17
#define GPS_TX 16
#define GPS_UART 1

// Discovery Mode Configuration
#define DISCOVERY_BUTTON_PIN 0     // GPIO0 (BOOT button on ESP32 dev boards)
#define DISCOVERY_LED_PIN 2        // GPIO2 for discovery status LED (built-in LED)
#define DISCOVERY_TIMEOUT_MS (5 * 60 * 1000)  // 5 minutes timeout

bool discoveryModeActive = false;
unsigned long discoveryModeStartTime = 0;
bool lastButtonState = HIGH;
unsigned long lastButtonDebounceTime = 0;
const unsigned long debounceDelay = 50;
bool buttonProcessed = false;

// RS485 Wind Sensor
HardwareSerial rs485(RS485_UART);
ModbusMaster windSensor;

// GPS Module
HardwareSerial gpsSerial(GPS_UART);
TinyGPSPlus gps;

// Regatta start line data structure
struct RegattaData {
  bool hasStartLine;         // True if both port and starboard positions are set
  double portLat;           // Port end GPS latitude
  double portLon;           // Port end GPS longitude
  double starboardLat;      // Starboard end GPS latitude  
  double starboardLon;      // Starboard end GPS longitude
  float distanceToLine;     // Current distance to start line in meters
};

// Regatta data
RegattaData regattaData = {false, 0.0, 0.0, 0.0, 0.0, -1.0};

// Regatta Functions (prototypes)
float haversineDistance(double lat1, double lon1, double lat2, double lon2);
float distanceToLine(double px, double py, double x1, double y1, double x2, double y2);
void calculateRegattaData();
bool isValidGPSCoordinates(double lat, double lon);

// Function prototypes (declared early for use in callbacks)
bool safeBLESend(const String& data, bool isCommand = false);
void setupBLE();
void restartBLE();
void setupBLEServer();
void preTransmission();
void postTransmission();
void generateRandomBLEAddress();
void resetBLEForNewName(const String& newName);
void handleDiscoveryButton();
void startDiscoveryMode();
void stopDiscoveryMode();
void updateDiscoveryStatus();
void updateRefreshRate();



// Safe BLE transmission function to prevent data corruption
bool safeBLESend(const String& data, bool isCommand) {
  Serial.printf("[BLE DEBUG] Attempting to send %d chars, command=%s\n", 
               data.length(), isCommand ? "true" : "false");
  
  // Check if we have a valid connection and characteristic
  if (!pServer || pServer->getConnectedCount() == 0 || !pSensorDataCharacteristic) {
    Serial.println("[BLE DEBUG] FAILED: No server, connection, or characteristic");
    return false;
  }
  
  Serial.printf("[BLE DEBUG] Connected devices: %d\n", pServer->getConnectedCount());
  
  // Wait for any ongoing transmission to complete (max 100ms timeout)
  unsigned long startTime = millis();
  while (bleSending && (millis() - startTime) < 100) {
    delay(1);
  }
  
  // If still sending after timeout, skip this transmission
  if (bleSending) {
    Serial.println("[BLE DEBUG] FAILED: Transmission timeout, skipping...");
    return false;
  }
  
  // Set sending flag
  bleSending = true;
  try {
    // Convert string to byte array to avoid encoding issues
    std::vector<uint8_t> dataBytes(data.begin(), data.end());
    
    pSensorDataCharacteristic->setValue(dataBytes);
    pSensorDataCharacteristic->notify();
    // Small delay to ensure transmission completes
    delay(isCommand ? 10 : 5);
    Serial.printf("[BLE DEBUG] Delay completed (%d ms)\n", isCommand ? 10 : 5);
    
    bleSending = false;
    return true;
  } catch (...) {
    bleSending = false;
    Serial.println("[BLE DEBUG] FAILED: Exception during transmission");
    return false;
  }
}

// BLE Server Callbacks
class MyServerCallbacks: public NimBLEServerCallbacks {
    void onConnect(NimBLEServer* pServer) {
      connectedDeviceCount++;
      deviceConnected = true;
      Serial.printf("BLE Client connected (total: %d)\n", connectedDeviceCount);
      
      // Send firmware version after connection
      delay(1000); // Give client time to set up characteristics
      if (pSensorDataCharacteristic) {
        DynamicJsonDocument doc(128);
        doc["type"] = "firmware_version";
        doc["version"] = FIRMWARE_VERSION;
        String versionData;
        serializeJson(doc, versionData);
        
        if (safeBLESend(versionData, true)) {
          Serial.printf("Sent firmware version on connect: %s\n", FIRMWARE_VERSION);
        } else {
          Serial.println("Failed to send firmware version on connect");
        }
      }
      
      // Continue advertising if we haven't reached max connections AND discovery mode is active
      if (connectedDeviceCount < CONFIG_BT_NIMBLE_MAX_CONNECTIONS && discoveryModeActive) {
        delay(100); // Small delay before restarting advertising
        NimBLEDevice::startAdvertising();
        Serial.printf("Continuing advertising for additional connections... (%d/%d connected)\n", 
                     connectedDeviceCount, CONFIG_BT_NIMBLE_MAX_CONNECTIONS);
      } else {
        if (connectedDeviceCount >= CONFIG_BT_NIMBLE_MAX_CONNECTIONS) {
          Serial.printf("Maximum connections reached (%d/%d)\n", 
                       connectedDeviceCount, CONFIG_BT_NIMBLE_MAX_CONNECTIONS);
        } else {
          Serial.println("Discovery mode not active, stopping advertising for new connections");
        }
      }
    };

    void onDisconnect(NimBLEServer* pServer) {
      connectedDeviceCount--;
      if (connectedDeviceCount == 0) {
        deviceConnected = false;
        bleRSSI = 0; // Reset RSSI when all devices disconnected
      }
      Serial.printf("BLE Client disconnected (remaining: %d/%d)\n", 
                   connectedDeviceCount, CONFIG_BT_NIMBLE_MAX_CONNECTIONS);
      
      // Restart advertising when a device disconnects if discovery mode is active
      delay(500);
      if (!NimBLEDevice::getAdvertising()->isAdvertising() && discoveryModeActive && connectedDeviceCount < CONFIG_BT_NIMBLE_MAX_CONNECTIONS) {
        NimBLEDevice::startAdvertising();
        Serial.println("Restarting advertising after disconnection (discovery mode active)...");
      } else if (!discoveryModeActive) {
        Serial.println("Discovery mode not active, not restarting advertising");
      }
    }
};

class CommandCallbacks: public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic *pCharacteristic) {
      std::string value = pCharacteristic->getValue();
      
      if (value.length() > 0) {
        Serial.printf("[BLE RECV] Received %d bytes\n", value.length());
        
        #ifdef DEBUG_BLE_DATA
        Serial.print("BLE Command received: ");
        Serial.println(value.c_str());
        #endif
        
        // Parse JSON command - increased buffer size for base64 chunk data
        // Base64 chunks can be ~440 bytes total with JSON overhead
        DynamicJsonDocument doc(512);
        DeserializationError error = deserializeJson(doc, value.c_str());
        
        if (!error) {
          String action = doc["action"];
          String cmd = doc["cmd"];
          
          Serial.printf("[BLE RECV] Parsed JSON - action: '%s', cmd: '%s'\n", 
                       action.c_str(), cmd.c_str());
          
          // Log OTA-related commands with extra detail
          if (cmd == "START_FW_UPDATE" || cmd == "FW_CHUNK" || cmd == "VERIFY_FW" || cmd == "APPLY_FW") {
            Serial.printf("[OTA CMD] Received: %s\n", cmd.c_str());
            if (cmd == "FW_CHUNK") {
              int chunkIndex = doc["index"];
              Serial.printf("[OTA CMD] Chunk index: %d\n", chunkIndex);
            }
          }
          
          if (action == "resetHeelAngle") {
            // Calibrate vessel level position (boat is level, any heading)
            if (imuAvailable) {
              if (imu.dataAvailable()) {
                // Get current heel/pitch from accelerometer
                float accelX = imu.getAccelX();
                float accelY = imu.getAccelY();
                float accelZ = imu.getAccelZ();
                
                float currentRoll = atan2(accelX, sqrt(accelY * accelY + accelZ * accelZ)) * 180.0f / PI;
                float currentPitch = atan2(accelY, sqrt(accelX * accelX + accelZ * accelZ)) * 180.0f / PI;
                
                // Store these as offsets
                rollOffset = currentRoll;
                pitchOffset = currentPitch;
                levelCalibrated = true;
                
                // Save to NVS
                preferences.putFloat("rollOffset", rollOffset);
                preferences.putFloat("pitchOffset", pitchOffset);
                preferences.putBool("levelCal", true);
                
                Serial.printf("Level calibrated - Roll offset: %.2f°, Pitch offset: %.2f°\n", rollOffset, pitchOffset);
              } else {
                Serial.println("Level calibration failed - can't read IMU sensor");
              }
            } else {
              Serial.println("Level calibration failed - IMU sensor not available");
            }
          }
          else if (action == "resetCompassNorth") {
            // Calibrate compass north (bow points north, any heel angle)
            if (imuAvailable) {
              if (imu.dataAvailable()) {
                // Use rotation vector (includes magnetometer fusion)
                float quatI = imu.getQuatI();
                float quatJ = imu.getQuatJ();
                float quatK = imu.getQuatK();
                float quatReal = imu.getQuatReal();
                
                float quatMag = sqrt(quatI*quatI + quatJ*quatJ + quatK*quatK + quatReal*quatReal);
                
                if (quatMag > 0.1) {
                  // Calculate current tilt-compensated heading from rotation vector quaternion
                  float currentHeading = atan2(2.0f * (quatI*quatJ + quatReal*quatK),
                                             quatReal*quatReal + quatI*quatI - quatJ*quatJ - quatK*quatK);
                  currentHeading = currentHeading * 180.0f / PI;
                  if (currentHeading < 0) currentHeading += 360.0f;
                  
                  // Store this as the heading offset (when bow points north, this should become 0°)
                  headingOffset = currentHeading;
                  preferences.putFloat("headingOffset", headingOffset);
                  
                  northCalibrated = true;
                  preferences.putBool("northCal", true);
                  
                  Serial.printf("North calibrated - heading offset: %.1f°\n", headingOffset);
                } else {
                  Serial.println("Compass calibration failed - rotation vector not ready");
                }
              } else {
                Serial.println("Compass calibration failed - sensor data not available");
              }
            } else {
              Serial.println("Compass calibration failed - IMU sensor not available");
            }
          }
          else if (action == "regattaSetPort") {
            if (gps.location.isValid()) {
              double lat = gps.location.lat();
              double lon = gps.location.lng();
              
              // Validate coordinates are within valid ranges
              if (!isValidGPSCoordinates(lat, lon)) {
                Serial.println("Cannot set regatta port position - GPS coordinates out of valid range");
              } else {
                regattaData.portLat = lat;
                regattaData.portLon = lon;
                
                // Save to NVS
                preferences.begin("veetr", false);
                preferences.putDouble("portLat", regattaData.portLat);
                preferences.putDouble("portLon", regattaData.portLon);
                preferences.end();
                
                // Check if we now have both ends of the line
                if (regattaData.starboardLat != 0.0 && regattaData.starboardLon != 0.0) {
                  regattaData.hasStartLine = true;
                }
                
                Serial.printf("Regatta port position set and saved: %.6f, %.6f\n", regattaData.portLat, regattaData.portLon);
                
                // Send updated coordinates back to PWA
                DynamicJsonDocument response(256);
                response["type"] = "regatta_coords";
                response["portLat"] = regattaData.portLat;
                response["portLon"] = regattaData.portLon;
                response["starboardLat"] = regattaData.starboardLat;
                response["starboardLon"] = regattaData.starboardLon;
                
                String responseStr;
                serializeJson(response, responseStr);
                safeBLESend(responseStr, true);
              }
            } else {
              Serial.println("Cannot set regatta port position - GPS fix not available");
            }
          }
          else if (action == "regattaSetStarboard") {
            if (gps.location.isValid()) {
              double lat = gps.location.lat();
              double lon = gps.location.lng();
              
              // Validate coordinates are within valid ranges
              if (!isValidGPSCoordinates(lat, lon)) {
                Serial.println("Cannot set regatta starboard position - GPS coordinates out of valid range");
              } else {
                regattaData.starboardLat = lat;
                regattaData.starboardLon = lon;
                
                // Save to NVS
                preferences.begin("veetr", false);
                preferences.putDouble("starboardLat", regattaData.starboardLat);
                preferences.putDouble("starboardLon", regattaData.starboardLon);
                preferences.end();
                
                // Check if we now have both ends of the line
                if (regattaData.portLat != 0.0 && regattaData.portLon != 0.0) {
                  regattaData.hasStartLine = true;
                }
                
                Serial.printf("Regatta starboard position set and saved: %.6f, %.6f\n", regattaData.starboardLat, regattaData.starboardLon);
                
                // Send updated coordinates back to PWA
                DynamicJsonDocument response(256);
                response["type"] = "regatta_coords";
                response["portLat"] = regattaData.portLat;
                response["portLon"] = regattaData.portLon;
                response["starboardLat"] = regattaData.starboardLat;
                response["starboardLon"] = regattaData.starboardLon;
                
                String responseStr;
                serializeJson(response, responseStr);
                safeBLESend(responseStr, true);
              }
            } else {
              Serial.println("Cannot set regatta starboard position - GPS fix not available");
            }
          }
          else if (action == "regattaClearPort") {
            regattaData.portLat = 0.0;
            regattaData.portLon = 0.0;
            regattaData.hasStartLine = false;
            
            // Clear from NVS
            preferences.begin("veetr", false);
            preferences.remove("portLat");
            preferences.remove("portLon");
            preferences.end();
            
            Serial.println("Regatta port position cleared");
          }
          else if (action == "regattaClearStarboard") {
            regattaData.starboardLat = 0.0;
            regattaData.starboardLon = 0.0;
            regattaData.hasStartLine = false;
            
            // Clear from NVS
            preferences.begin("veetr", false);
            preferences.remove("starboardLat");
            preferences.remove("starboardLon");
            preferences.end();
            
            Serial.println("Regatta starboard position cleared");
          }
          else if (action == "regattaGet") {
            // Send current regatta line coordinates
            DynamicJsonDocument response(256);
            response["type"] = "regatta_coords";
            response["portLat"] = regattaData.portLat;
            response["portLon"] = regattaData.portLon;
            response["starboardLat"] = regattaData.starboardLat;
            response["starboardLon"] = regattaData.starboardLon;
            
            String responseStr;
            serializeJson(response, responseStr);
            
            if (safeBLESend(responseStr, true)) {
              Serial.printf("Sent regatta coordinates: port(%.6f,%.6f) starboard(%.6f,%.6f)\n",
                           regattaData.portLat, regattaData.portLon,
                           regattaData.starboardLat, regattaData.starboardLon);
            } else {
              Serial.println("Failed to send regatta coordinates");
            }
          }
          else if (action == "setRefreshRate") {
            float newRefreshRate = doc["refreshRate"];
            if (newRefreshRate >= 0.5f && newRefreshRate <= 2.0f) {
              refreshRateSeconds = newRefreshRate;
              preferences.putFloat("refreshRate", refreshRateSeconds);
              updateRefreshRate();
              Serial.printf("Refresh rate changed to %.1f seconds (%d ms)\n", refreshRateSeconds, (int)(refreshRateSeconds * 1000.0f));
              
              // Send confirmation response
              DynamicJsonDocument response(128);
              response["type"] = "refresh_rate_updated";
              response["refreshRate"] = refreshRateSeconds;
              String responseStr;
              serializeJson(response, responseStr);
              safeBLESend(responseStr, true);
            } else {
              Serial.println("Invalid refresh rate - must be between 0.5 and 2.0 seconds");
            }
          }
          else if (action == "setDeviceName") {
            String newDeviceName = doc["deviceName"];
            if (newDeviceName.length() > 0 && newDeviceName.length() <= 20) {
              // Basic validation: remove leading/trailing spaces and validate characters
              newDeviceName.trim();
              
              // Check for invalid characters that could break BLE device name
              bool validName = true;
              for (int i = 0; i < newDeviceName.length(); i++) {
                char c = newDeviceName[i];
                // Allow alphanumeric, underscore, hyphen, and space for device names
                if (!((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || 
                      (c >= '0' && c <= '9') || c == '_' || c == '-' || c == ' ')) {
                  validName = false;
                  break;
                }
              }
              
              if (validName && newDeviceName.length() > 0) {
                // Get current device name for comparison
                String currentDeviceName = preferences.getString("deviceName", "Veetr");
                
                // Save new device name to preferences
                preferences.putString("deviceName", newDeviceName);
                
                // CRITICAL: Ensure preferences are committed to NVS before restart
                preferences.end();  // Close preferences to force commit
                delay(100);         // Give time for flash write
                preferences.begin("settings", false);  // Reopen preferences
                
                // Verify the name was actually saved
                String savedName = preferences.getString("deviceName", "Veetr");
                Serial.printf("Device name changed from '%s' to '%s'\n", currentDeviceName.c_str(), newDeviceName.c_str());
                Serial.printf("Verified saved name: '%s'\n", savedName.c_str());
                
                if (savedName != newDeviceName) {
                  Serial.println("ERROR: Device name not saved properly to NVS!");
                  return; // Don't restart if save failed
                }
                
                // Send success response first before restarting
                Serial.println("Device name saved successfully - ESP32 will restart to apply changes");
                
                // Reset BLE with new random address to bypass client cache
                resetBLEForNewName(newDeviceName);
                
                // Restart ESP32 to apply new device name
                Serial.println("ESP32 will restart in 1 second");
                delay(200); // Brief delay to ensure BLE response is sent
                ESP.restart();
              } else {
                Serial.println("Invalid device name - only alphanumeric, underscore, hyphen, and space allowed");
              }
            } else {
              Serial.println("Invalid device name - must be 1-20 characters");
            }
          }
          else if (action == "restartWithNewName") {
            Serial.println("Restarting ESP32 to apply new device name...");
            delay(500); // Give time for response to be sent
            ESP.restart();
          }
          else if (doc["cmd"] == "GET_FW_VERSION") {
            // Send firmware version response
            DynamicJsonDocument response(128);
            response["type"] = "firmware_version";
            response["version"] = FIRMWARE_VERSION;
            String responseStr;
            serializeJson(response, responseStr);
            
            if (safeBLESend(responseStr, true)) {
              Serial.printf("Sent firmware version: %s\n", FIRMWARE_VERSION);
            } else {
              Serial.println("Failed to send firmware version response");
            }
          }
          else if (doc["cmd"] == "GET_DEVICE_NAME") {
            // Send device name response
            String deviceName = preferences.getString("deviceName", "Veetr");
            DynamicJsonDocument response(128);
            response["type"] = "device_name";
            response["deviceName"] = deviceName;
            String responseStr;
            serializeJson(response, responseStr);
            
            if (safeBLESend(responseStr, true)) {
              Serial.printf("Sent device name: %s\n", deviceName.c_str());
            } else {
              Serial.println("Failed to send device name response");
            }
          }
          else if (doc["cmd"] == "GET_REGATTA_LINE") {
            // Send regatta line coordinates response
            DynamicJsonDocument response(256);
            response["type"] = "regatta_line";
            response["portLat"] = regattaData.portLat;
            response["portLon"] = regattaData.portLon;
            response["starboardLat"] = regattaData.starboardLat;
            response["starboardLon"] = regattaData.starboardLon;
            String responseStr;
            serializeJson(response, responseStr);
            
            if (safeBLESend(responseStr, true)) {
              Serial.println("[Regatta] Sent start line coordinates");
            } else {
              Serial.println("[Regatta] Failed to send start line coordinates");
            }
          }
          else if (doc["cmd"] == "START_FW_UPDATE") {
            Serial.println("[BLE OTA] Starting firmware update using ESP32 Update library");
            
            // Get firmware size - required for Update.begin()
            if (!doc.containsKey("size")) {
              Serial.println("[BLE OTA] Error: Firmware size not provided");
              DynamicJsonDocument response(128);
              response["type"] = "error";
              response["message"] = "Firmware size required";
              String responseStr;
              serializeJson(response, responseStr);
              safeBLESend(responseStr, true);
              return;
            }
            
            otaSize = doc["size"];
            Serial.printf("[BLE OTA] Firmware size: %u bytes\n", otaSize);
            
            // Check available space and state
            Serial.printf("[BLE OTA] Free heap: %u bytes\n", ESP.getFreeHeap());
            Serial.printf("[BLE OTA] Flash size: %u bytes\n", ESP.getFlashChipSize());
            
            // Ensure clean state by aborting any previous update
            if (Update.isRunning()) {
              Serial.println("[BLE OTA] Aborting previous update operation");
              Update.abort();
            }
            
            // Begin OTA update
            if (!Update.begin(otaSize)) {
              uint8_t error = Update.getError();
              Serial.printf("[BLE OTA] Update.begin() failed: %s (error code: %u)\n", Update.errorString(), error);
              DynamicJsonDocument response(128);
              response["type"] = "error";
              response["message"] = "Failed to begin update";
              String responseStr;
              serializeJson(response, responseStr);
              safeBLESend(responseStr, true);
              return;
            }
            
            bleOTAActive = true;
            otaStartTime = millis();
            otaWritten = 0;
            
            Serial.println("[BLE OTA] Ready to receive firmware data");
            
            // Send acknowledgment
            DynamicJsonDocument response(128);
            response["type"] = "update_ready";
            String responseStr;
            serializeJson(response, responseStr);
            safeBLESend(responseStr, true);
          }
          else if (doc["cmd"] == "STOP_FW_UPDATE") {
            Serial.println("[BLE OTA] Stopping firmware update");
            
            if (bleOTAActive) {
              Update.abort();
              Serial.println("[BLE OTA] Update aborted");
            }
            
            bleOTAActive = false;
            otaStartTime = 0;
            otaWritten = 0;
            otaSize = 0;
            
            DynamicJsonDocument response(128);
            response["type"] = "update_stopped";
            String responseStr;
            serializeJson(response, responseStr);
            safeBLESend(responseStr, true);
          }
          else if (doc["cmd"] == "GET_OTA_STATUS") {
            // Send OTA status response
            DynamicJsonDocument response(256);
            response["type"] = "ota_status";
            response["active"] = bleOTAActive;
            response["library"] = "ESP32 Update";
            
            if (bleOTAActive && otaStartTime > 0) {
              response["elapsed_ms"] = millis() - otaStartTime;
              response["written"] = otaWritten;
              response["size"] = otaSize;
              if (otaSize > 0) {
                response["progress"] = (float)otaWritten / otaSize * 100.0;
              }
            }
            
            String responseStr;
            serializeJson(response, responseStr);
            safeBLESend(responseStr, true);
          }
          else if (doc["cmd"] == "FW_CHUNK") {
            if (!bleOTAActive) {
              Serial.println("[BLE OTA] Error: Firmware update not active");
              DynamicJsonDocument response(128);
              response["type"] = "error";
              response["message"] = "Update not active";
              String responseStr;
              serializeJson(response, responseStr);
              safeBLESend(responseStr, true);
              return;
            }
            
            // Get chunk index and data from base64
            int chunkIndex = doc["index"];
            if (!doc.containsKey("data")) {
              Serial.println("[BLE OTA] Error: No data in chunk");
              DynamicJsonDocument response(128);
              response["type"] = "error";
              response["message"] = "No chunk data";
              String responseStr;
              serializeJson(response, responseStr);
              safeBLESend(responseStr, true);
              return;
            }
            
            // Decode base64 data
            String dataB64 = doc["data"];
            int expectedLen = (dataB64.length() * 3) / 4;
            uint8_t* decodedData = (uint8_t*)malloc(expectedLen);
            int actualLen = base64_decode(dataB64.c_str(), decodedData);
            
            if (actualLen <= 0) {
              Serial.println("[BLE OTA] Base64 decode failed");
              free(decodedData);
              DynamicJsonDocument response(128);
              response["type"] = "error";
              response["message"] = "Base64 decode failed";
              String responseStr;
              serializeJson(response, responseStr);
              safeBLESend(responseStr, true);
              return;
            }
            
            // Write chunk to flash
            size_t written = Update.write(decodedData, actualLen);
            free(decodedData);
            
            if (written != actualLen) {
              Serial.printf("[BLE OTA] Write failed: %s\n", Update.errorString());
              DynamicJsonDocument response(128);
              response["type"] = "error";
              response["message"] = "Write failed";
              String responseStr;
              serializeJson(response, responseStr);
              safeBLESend(responseStr, true);
              return;
            }
            
            otaWritten += written;
            Serial.printf("[BLE OTA] Wrote %u bytes, total: %u/%u (%.1f%%)\n", 
                         written, otaWritten, otaSize, (float)otaWritten/otaSize*100.0);
            
            // Send chunk acknowledgment
            DynamicJsonDocument response(128);
            response["type"] = "chunk_ack";
            response["index"] = chunkIndex;
            response["written"] = otaWritten;
            response["progress"] = (float)otaWritten / otaSize * 100.0;
            String responseStr;
            serializeJson(response, responseStr);
            safeBLESend(responseStr, true);
          }
          else if (doc["cmd"] == "VERIFY_FW") {
            if (!bleOTAActive) {
              Serial.println("[BLE OTA] Error: Firmware update not active");
              DynamicJsonDocument response(128);
              response["type"] = "error";
              response["message"] = "Update not active";
              String responseStr;
              serializeJson(response, responseStr);
              safeBLESend(responseStr, true);
              return;
            }
            
            // Finalize the update
            if (Update.end(true)) {
              Serial.println("[BLE OTA] Firmware update completed successfully!");
              
              DynamicJsonDocument response(128);
              response["type"] = "update_complete";
              response["message"] = "Firmware verified and ready to apply";
              String responseStr;
              serializeJson(response, responseStr);
              safeBLESend(responseStr, true);
            } else {
              Serial.printf("[BLE OTA] Update failed: %s\n", Update.errorString());
              
              DynamicJsonDocument response(128);
              response["type"] = "error";
              response["message"] = "Verification failed";
              String responseStr;
              serializeJson(response, responseStr);
              safeBLESend(responseStr, true);
            }
            
            bleOTAActive = false;
            otaStartTime = 0;
            otaWritten = 0;
            otaSize = 0;
          }
          else if (doc["cmd"] == "APPLY_FW") {
            Serial.println("[BLE OTA] Applying firmware update - restarting...");
            
            // Send response before restart
            DynamicJsonDocument response(128);
            response["type"] = "restarting";
            response["message"] = "Applying firmware update";
            String responseStr;
            serializeJson(response, responseStr);
            safeBLESend(responseStr, true);
            
            delay(1000); // Give time for response to be sent
            ESP.restart();
          }
        } else {
          Serial.printf("[BLE RECV] JSON parsing failed: %s\n", error.c_str());
          Serial.printf("[BLE RECV] Raw data: %s\n", value.c_str());
        }
      } else {
        Serial.println("[BLE RECV] Received empty message");
      }
    }
};

// Function to read BLE connection RSSI
void updateBLERSSI() {
  static unsigned long lastRSSIUpdate = 0;
  static int rssiReadings[5] = {0}; // Sliding window for smoothing
  static int rssiIndex = 0;
  static bool rssiArrayInitialized = false;
  
  // Only update RSSI every 3 seconds to reduce noise
  if (millis() - lastRSSIUpdate < 3000) {
    return;
  }
  
  if (deviceConnected && pServer) {
    // Get the actual RSSI from connected devices
    std::vector<uint16_t> connIds = pServer->getPeerDevices();
    if (!connIds.empty()) {
      // Use NimBLE API to get RSSI for the first connected device
      uint16_t connHandle = connIds[0];
      
      // Call the NimBLE function to read RSSI
      int8_t rssi = 0;
      if (ble_gap_conn_rssi(connHandle, &rssi) == 0) {
        bleRSSI = rssi;
        
        // Initialize array with first reading
        if (!rssiArrayInitialized) {
          for (int i = 0; i < 5; i++) {
            rssiReadings[i] = rssi;
          }
          rssiArrayInitialized = true;
        }
        
        // Add new reading to sliding window
        rssiReadings[rssiIndex] = rssi;
        rssiIndex = (rssiIndex + 1) % 5;
        
        // Calculate smoothed average
        int sum = 0;
        for (int i = 0; i < 5; i++) {
          sum += rssiReadings[i];
        }
        bleRSSIFiltered = sum / 5;
        
      } else {
        bleRSSI = -50; // Fallback if RSSI read fails
        bleRSSIFiltered = -50;
      }
      
      #ifdef DEBUG_BLE_DATA
      static unsigned long lastRSSIDebug = 0;
      if (millis() - lastRSSIDebug > 10000) { // Debug every 10 seconds
        Serial.printf("[BLE] %d devices connected, RSSI: %d dBm (filtered: %d dBm)\n", connIds.size(), bleRSSI, bleRSSIFiltered);
        // Show RSSI for all connected devices
        for (uint16_t connId : connIds) {
          int8_t deviceRSSI = 0;
          if (ble_gap_conn_rssi(connId, &deviceRSSI) == 0) {
            Serial.printf("  Device %d: %d dBm\n", connId, deviceRSSI);
          }
        }
        lastRSSIDebug = millis();
      }
      #endif
    } else {
      bleRSSI = 0; // No valid connection IDs
      bleRSSIFiltered = 0;
    }
  } else {
    bleRSSI = 0; // No connection
    bleRSSIFiltered = 0;
  }
  
  lastRSSIUpdate = millis();
}

// Discovery Mode Functions
void handleDiscoveryButton() {
  int reading = digitalRead(DISCOVERY_BUTTON_PIN);
  
  // Check for state change
  if (reading != lastButtonState) {
    lastButtonDebounceTime = millis();
    Serial.printf("[DISCOVERY] Button state changed: %s (raw value: %d)\n", 
                  reading == LOW ? "PRESSED" : "RELEASED", reading);
    lastButtonState = reading;  // Update immediately on state change
  }
  
  // Check for stable button press after debounce delay
  if ((millis() - lastButtonDebounceTime) > debounceDelay) {
    if (reading == LOW && !buttonProcessed) {
      // Button is pressed and stable, and we haven't processed this press yet
      Serial.println("[DISCOVERY] *** BUTTON PRESS DETECTED! ***");
      buttonProcessed = true;  // Mark as processed
      
      if (!discoveryModeActive) {
        Serial.println("[DISCOVERY] Starting discovery mode...");
        startDiscoveryMode();
      } else {
        Serial.println("[DISCOVERY] Stopping discovery mode...");
        stopDiscoveryMode();
      }
    } else if (reading == HIGH) {
      // Button is released, reset the processed flag
      buttonProcessed = false;
    }
  }
}

void startDiscoveryMode() {
  Serial.println("[DISCOVERY] Starting discovery mode for 5 minutes...");
  discoveryModeActive = true;
  discoveryModeStartTime = millis();
  
  // Turn on discovery LED (solid, not blinking initially)
  digitalWrite(DISCOVERY_LED_PIN, HIGH);
  Serial.printf("[DISCOVERY] LED pin %d set to HIGH\n", DISCOVERY_LED_PIN);
  
  // Start BLE advertising if not already active
  if (!NimBLEDevice::getAdvertising()->isAdvertising()) {
    NimBLEDevice::startAdvertising();
    Serial.println("[DISCOVERY] BLE advertising started");
  } else {
    Serial.println("[DISCOVERY] BLE advertising already active");
  }
}

void stopDiscoveryMode() {
  Serial.println("[DISCOVERY] Stopping discovery mode");
  discoveryModeActive = false;
  
  // Turn off discovery LED
  digitalWrite(DISCOVERY_LED_PIN, LOW);
  Serial.printf("[DISCOVERY] LED pin %d set to LOW\n", DISCOVERY_LED_PIN);
  
  // Stop BLE advertising if no devices are connected
  if (pServer && pServer->getConnectedCount() == 0) {
    NimBLEDevice::getAdvertising()->stop();
    Serial.println("[DISCOVERY] BLE advertising stopped (no connected devices)");
  } else {
    Serial.printf("[DISCOVERY] BLE advertising continues (%d devices connected)\n", 
                  pServer ? pServer->getConnectedCount() : 0);
  }
}

void updateDiscoveryStatus() {
  if (discoveryModeActive) {
    // Check if discovery timeout has elapsed
    if (millis() - discoveryModeStartTime > DISCOVERY_TIMEOUT_MS) {
      stopDiscoveryMode();
    } else {
      // Blink LED to show discovery is active (after first 3 seconds)
      if (millis() - discoveryModeStartTime > 3000) {
        static unsigned long lastBlink = 0;
        if (millis() - lastBlink > 1000) { // Blink every second
          digitalWrite(DISCOVERY_LED_PIN, !digitalRead(DISCOVERY_LED_PIN));
          lastBlink = millis();
        }
      }
    }
  }
}

// ModbusMaster callback functions for RS485 control
void preTransmission() { 
  digitalWrite(RS485_DE, HIGH); 
}

void postTransmission() { 
  digitalWrite(RS485_DE, LOW); 
}

// Data structure to hold sensor readings
struct SensorData {
  float speed;          // Vessel speed in knots
  float windSpeed;      // Apparent wind speed in knots
  int windAngle;        // Apparent wind angle in degrees (0-360)
  float trueWindSpeed;  // True wind speed in knots
  int trueWindAngle;    // True wind angle in degrees (0-360)
  float tilt;           // Vessel heel/tilt angle in degrees (roll)
  float pitch;          // Vessel pitch/trim angle in degrees
  int HDM;              // Magnetic heading in degrees (0-359)
  float accelX;         // Acceleration X-axis in m/s²
  float accelY;         // Acceleration Y-axis in m/s²
  float accelZ;         // Acceleration Z-axis in m/s²
};

// Function to calculate true wind angle from apparent wind angle
void calculateTrueWind(float vesselSpeed, int apparentWindAngle, float apparentWindSpeed, 
                       float &trueWindSpeed, int &trueWindAngle) {
  
  // Convert apparent wind angle to radians (0-360° input)
  float appWindAngleRad = apparentWindAngle * PI / 180.0;
  
  // Convert apparent wind to velocity components (relative to vessel)
  // Apparent wind angle is measured clockwise from bow (0°=ahead, 90°=starboard, 180°=behind, 270°=port)
  float appWindX = apparentWindSpeed * sin(appWindAngleRad);  // Cross-track component (positive = starboard)
  float appWindY = apparentWindSpeed * cos(appWindAngleRad);  // Along-track component (positive = ahead)
  
  // True wind components = apparent wind - vessel velocity
  // Vessel is moving forward (positive Y direction)
  float trueWindX = appWindX;  // Cross-track component unchanged
  float trueWindY = appWindY - vesselSpeed;  // Subtract vessel forward speed
  
  // Calculate true wind speed
  trueWindSpeed = sqrt(trueWindX * trueWindX + trueWindY * trueWindY);
  
  // Calculate true wind angle (relative to vessel bow, 0-360°)
  float trueWindAngleRad = atan2(trueWindX, trueWindY);
  trueWindAngle = round(trueWindAngleRad * 180.0 / PI);
  
  // Normalize angle to 0-359° range
  if (trueWindAngle < 0) trueWindAngle += 360;
  if (trueWindAngle >= 360) trueWindAngle -= 360;
  
  // Ensure we don't have negative wind speeds
  if (trueWindSpeed < 0) {
    trueWindSpeed = 0;
  }
}

// Current sensor data
SensorData currentData = {0};

// GPS status
bool gpsDataValid = false;

// Refresh rate in milliseconds
int refreshRate = 1000;

// Function to update refresh rate from seconds to milliseconds
void updateRefreshRate() {
  refreshRate = (int)(refreshRateSeconds * 1000.0f);
  // Clamp to reasonable bounds (500ms to 2000ms)
  if (refreshRate < 500) refreshRate = 500;
  if (refreshRate > 2000) refreshRate = 2000;
}

// Timestamp for next update
unsigned long nextUpdate = 0;

// Regatta Functions (prototypes)
float haversineDistance(double lat1, double lon1, double lat2, double lon2);
float distanceToLine(double px, double py, double x1, double y1, double x2, double y2);
void calculateRegattaData();

// Function prototypes
void readSensors();
String getSensorDataJson();
void setupBLE();
void updateBLEData();
float filterGPSSpeed(float rawSpeed, int satellites, float hdop);

// Wind Sensor Functions
bool readWindSensor(float &windSpeed, int &windAngle);
float regsToFloat(uint16_t lowReg, uint16_t highReg);

// GPS Functions
bool readGPS();
bool isGPSDataValid();

// Generate random BLE address to help bypass client cache
void generateRandomBLEAddress() {
  uint8_t randomAddr[6];
  
  // Generate random MAC address
  esp_fill_random(randomAddr, 6);
  
  // Ensure it's a valid random address (first two bits should be '11')
  randomAddr[5] |= 0xC0;
  
  Serial.printf("[BLE] Generated random address: %02X:%02X:%02X:%02X:%02X:%02X\n",
               randomAddr[5], randomAddr[4], randomAddr[3], 
               randomAddr[2], randomAddr[1], randomAddr[0]);
}

// Reset BLE with new name and random address to bypass client cache
void resetBLEForNewName(const String& newName) {
  Serial.printf("[BLE] Preparing reset for device name: '%s'\n", newName.c_str());
  
  // Generate new random address before restart to help bypass client cache
  generateRandomBLEAddress();
  
  Serial.println("[BLE] ESP32 will restart with new name and random address");
}

// BLE Setup Function
void setupBLE() {
  // Get device name from preferences
  String deviceName = preferences.getString("deviceName", "Veetr");
  Serial.printf("[BLE] Initializing as '%s'\n", deviceName.c_str());
  Serial.printf("[BLE] Max connections configured: %d\n", CONFIG_BT_NIMBLE_MAX_CONNECTIONS);
  
  // Initialize NimBLE with device name
  NimBLEDevice::init(deviceName.c_str());
  // Request a larger MTU to support bigger notifications; client decides final value
  // Using 185 aligns with widely supported browser stacks
  NimBLEDevice::setMTU(185);
  
  // Use random address type to help bypass client cache on name changes
  NimBLEDevice::setOwnAddrType(BLE_OWN_ADDR_RANDOM);
  
  // Set TX power for good range
  NimBLEDevice::setPower(ESP_PWR_LVL_P3); // +3dBm
  
  // Setup the BLE server
  setupBLEServer();
  
  Serial.printf("BLE Server started as '%s'\n", deviceName.c_str());
}

// BLE Restart Function (for device name changes)
void restartBLE() {
  // Get device name from preferences
  String deviceName = preferences.getString("deviceName", "Veetr");
  Serial.printf("[BLE Restart] Using device name from preferences: '%s'\n", deviceName.c_str());
  
  // Ensure BLE is completely deinitialized first (only when restarting)
  Serial.println("[BLE Restart] Deinitializing existing BLE stack...");
  NimBLEDevice::deinit(true); // true = clear all bonding info
  delay(100); // Give time for cleanup
  
  // Initialize NimBLE with new device name
  Serial.printf("[BLE Restart] Initializing NimBLE with name: '%s'\n", deviceName.c_str());
  Serial.printf("[BLE Restart] Max connections configured: %d\n", CONFIG_BT_NIMBLE_MAX_CONNECTIONS);
  
  NimBLEDevice::init(deviceName.c_str());
  // Request larger MTU after re-init as well
  NimBLEDevice::setMTU(185);
  
  // Set TX power for balance between range and power consumption
  NimBLEDevice::setPower(ESP_PWR_LVL_P3); // +3dBm for better range
  
  // Setup the BLE server
  setupBLEServer();
  
  Serial.printf("NimBLE Server restarted as '%s', waiting for client connections...\n", deviceName.c_str());
  Serial.printf("Multiple connections supported (max %d)\n", CONFIG_BT_NIMBLE_MAX_CONNECTIONS);
}

// BLE Server Setup Function (without device initialization)
void setupBLEServer() {
  // Create the BLE Server with connection callbacks
  pServer = NimBLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  // Create the BLE Service
  NimBLEService *pService = pServer->createService(SERVICE_UUID);

  // Create BLE Characteristics
  pSensorDataCharacteristic = pService->createCharacteristic(
                      SENSOR_DATA_UUID,
                      NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY
                    );
  
  pCommandCharacteristic = pService->createCharacteristic(
                      COMMAND_UUID,
                      NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
                    );
  pCommandCharacteristic->setCallbacks(new CommandCallbacks());

  // Start the service
  pService->start();

  // Configure advertising for multiple connections
  NimBLEAdvertising *pAdvertising = NimBLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);  // 7.5ms intervals
  pAdvertising->setMaxPreferred(0x12);  // 22.5ms intervals
  pAdvertising->setAdvertisementType(BLE_GAP_CONN_MODE_UND);  // Undirected connectable
  
  // Include device name in advertising data
  String deviceName = preferences.getString("deviceName", "Veetr");
  pAdvertising->setName(deviceName.c_str());
  
  Serial.printf("[BLE] BLE server configured for up to %d connections\n", CONFIG_BT_NIMBLE_MAX_CONNECTIONS);
  Serial.println("[BLE] Advertising configured - press discovery button to enable connections");
}

// Update BLE with current sensor data
void updateBLEData() {
  if (deviceConnected && pSensorDataCharacteristic) {
    String jsonData = getSensorDataJson();
    
    // Ensure payload fits within conservative BLE MTU limits; if not, try reducing optional fields
    if (jsonData.length() > MAX_BLE_PACKET_SIZE) {
      Serial.printf("[BLE] JSON %d bytes exceeds safe limit %d; reducing optional fields...\n", jsonData.length(), MAX_BLE_PACKET_SIZE);
      
      // Attempt to shrink by removing low-priority fields
      StaticJsonDocument<1024> tmpDoc; // use static for deterministic stack allocation
      DeserializationError dErr = deserializeJson(tmpDoc, jsonData.c_str());
      if (!dErr) {
        // Remove least critical fields first
        tmpDoc.remove("accelX");
        tmpDoc.remove("accelY");
        tmpDoc.remove("accelZ");
        tmpDoc.remove("pitch");
        
        // Re-serialize and check
        String reduced;
        serializeJson(tmpDoc, reduced);
        
        if (reduced.length() > MAX_BLE_PACKET_SIZE) {
          // Remove additional optional identifiers if still too large
          tmpDoc.remove("deviceName");
          tmpDoc.remove("rssi");
          tmpDoc.remove("hdop");
          reduced = String();
          serializeJson(tmpDoc, reduced);
        }
        
        if (reduced.length() <= MAX_BLE_PACKET_SIZE) {
          jsonData = reduced;
          Serial.printf("[BLE] Reduced JSON to %d bytes\n", jsonData.length());
        } else {
          Serial.printf("[BLE] ERROR: Unable to reduce JSON below %d bytes (now %d)\n", MAX_BLE_PACKET_SIZE, reduced.length());
          return; // Skip sending to avoid fragmentation/corruption
        }
      } else {
        Serial.println("[BLE] ERROR: Failed to deserialize JSON for reduction");
        return;
      }
    }
    
    // Validate JSON format
    if (!jsonData.startsWith("{") || !jsonData.endsWith("}")) {
      Serial.println("[BLE] ERROR: Invalid JSON format");
      return;
    }
    
    #ifdef DEBUG_BLE_DATA
    Serial.printf("[BLE] %lu: Sending %d bytes to %d devices: %s\n", 
                  millis(), jsonData.length(), connectedDeviceCount, jsonData.c_str());
    #endif
    
    // Send to all connected devices
    // Double-check connection state before sending
    if (pServer->getConnectedCount() > 0) {
      if (safeBLESend(jsonData, false)) {
        #ifdef DEBUG_BLE_DATA
        Serial.printf("[BLE] Successfully sent %d bytes to %d devices\n", 
                      jsonData.length(), connectedDeviceCount);
        #endif
      } else {
        Serial.println("[BLE] Failed to send sensor data");
      }
    } else {
      Serial.println("[BLE] No connected devices found, skipping transmission");
    }
  }
}

void setup() {
  // Initialize serial communication first
  Serial.begin(115200);
  delay(1000); // Give serial time to initialize
  Serial.println("\n=== Veetr Starting ===");
  Serial.printf("[Boot] Firmware Version: %s\n", FIRMWARE_VERSION);
  
  // Debug OTA partition information
  const esp_partition_t* configured = esp_ota_get_boot_partition();
  const esp_partition_t* running = esp_ota_get_running_partition();
  Serial.printf("[Boot] Running partition: %s (address: 0x%x)\n", running->label, running->address);
  Serial.printf("[Boot] Configured boot partition: %s (address: 0x%x)\n", configured->label, configured->address);
  if (configured != running) {
    Serial.println("[Boot] WARNING: Configured partition differs from running partition!");
  }
  
  // Initialize Preferences for persistent storage
  preferences.begin("settings", false);
  
  // Load simple offset calibrations
  levelCalibrated = preferences.getBool("levelCal", false);
  if (levelCalibrated) {
    rollOffset = preferences.getFloat("rollOffset", 0.0f);
    pitchOffset = preferences.getFloat("pitchOffset", 0.0f);
    Serial.printf("[Boot] Loaded level calibration - Roll offset: %.2f°, Pitch offset: %.2f°\n",
                 rollOffset, pitchOffset);
  } else {
    Serial.println("[Boot] No level calibration found");
  }
  
  northCalibrated = preferences.getBool("northCal", false);
  if (northCalibrated) {
    headingOffset = preferences.getFloat("headingOffset", 0.0f);
    Serial.printf("[Boot] Loaded north calibration - Heading offset: %.1f°\n", headingOffset);
  } else {
    Serial.println("[Boot] No north calibration found");
  }
  
  // Load other settings
  deadWindAngle = preferences.getInt("deadWindAngle", 40);
  refreshRateSeconds = preferences.getFloat("refreshRate", 1.0f);
  String deviceName = preferences.getString("deviceName", "Veetr");
  
  Serial.print("[Boot] Loaded deadWindAngle from NVS: ");
  Serial.println(deadWindAngle);
  Serial.print("[Boot] Loaded refreshRate from NVS: ");
  Serial.println(refreshRateSeconds);
  Serial.print("[Boot] Loaded deviceName from NVS: ");
  Serial.println(deviceName);
  
  // Load regatta line coordinates from NVS
  regattaData.portLat = preferences.getDouble("portLat", 0.0);
  regattaData.portLon = preferences.getDouble("portLon", 0.0);
  regattaData.starboardLat = preferences.getDouble("starboardLat", 0.0);
  regattaData.starboardLon = preferences.getDouble("starboardLon", 0.0);
  
  // Check if we have a complete start line
  if (regattaData.portLat != 0.0 && regattaData.portLon != 0.0 && 
      regattaData.starboardLat != 0.0 && regattaData.starboardLon != 0.0) {
    regattaData.hasStartLine = true;
    Serial.printf("[Boot] Loaded regatta start line from NVS - Port: %.6f,%.6f Starboard: %.6f,%.6f\n",
                  regattaData.portLat, regattaData.portLon,
                  regattaData.starboardLat, regattaData.starboardLon);
  } else {
    Serial.println("[Boot] No saved regatta start line");
  }
  
  // Update refresh rate from loaded value
  updateRefreshRate();
  Serial.printf("[Boot] Refresh rate set to %d ms (%.1f seconds)\n", refreshRate, refreshRateSeconds);
  
  // Initialize I2C for BNO080 with detection
  Wire.begin(BNO080_SDA, BNO080_SCL);
  Wire.setClock(400000); // Set I2C to 400kHz Fast mode (BNO08X supports up to 400kHz)
  Wire.setTimeout(100); // Set I2C timeout to 100ms to prevent long blocking
  
  Serial.print("Testing BNO080 connection... ");
  Serial.printf("I2C SDA=%d, SCL=%d\n", BNO080_SDA, BNO080_SCL);
  
  // Test I2C bus first
  Wire.beginTransmission(0x4A); // BNO080 default I2C address
  uint8_t i2cError = Wire.endTransmission();
  Serial.printf("I2C scan result: %d (0=success, 2=NACK, 4=other error)\n", i2cError);
  
  if (imu.begin()) {
    Serial.println("BNO080 begin() successful, configuring sensor...");
    
    // Enable accelerometer for fast heel/pitch (50ms = 20Hz)
    imu.enableAccelerometer(50);
    Serial.println("Accelerometer configuration sent (20Hz)");
    
    // Enable rotation vector (gyro + accel + mag fusion with tilt compensation)
    // This includes magnetometer, so heading will be tilt-compensated
    imu.enableRotationVector(100); // 100ms = 10Hz for stable heading
    Serial.println("Rotation vector configuration sent (10Hz)");
    
    // Give sensor more time to initialize and start providing data
    Serial.println("Waiting for sensor data...");
    delay(500); // Longer delay for BNO080 to stabilize
    
    // Try multiple times to get data
    bool dataFound = false;
    for (int attempt = 0; attempt < 10; attempt++) {
      if (imu.dataAvailable()) {
        dataFound = true;
        Serial.printf("Data available after %d attempts!\n", attempt + 1);
        break;
      }
      delay(100); // Wait 100ms between attempts
      Serial.print(".");
    }
    Serial.println();
    
    if (dataFound) {
      imuAvailable = true;
      Serial.println("BNO080 connected and working!");
      
      // Test reading actual data
      float testI = imu.getQuatI();
      float testReal = imu.getQuatReal();
      Serial.printf("Test quaternion read: i=%.3f, real=%.3f\n", testI, testReal);
    } else {
      imuAvailable = false;
      Serial.println("BNO080 detected but no data available after 10 attempts");
      Serial.println("Check power supply (3.3V) and wiring connections");
    }
  } else {
    imuAvailable = false;
    Serial.println("Not detected - check wiring/address");
    Serial.println("Trying alternative I2C address 0x4B...");
    
    // Try alternative address
    Wire.beginTransmission(0x4B);
    i2cError = Wire.endTransmission();
    Serial.printf("I2C scan 0x4B result: %d\n", i2cError);
  }
  
  if (imuAvailable) {
    Serial.println("BNO080 IMU sensor enabled");
  } else {
    Serial.println("BNO080 IMU sensor disabled - tilt will be set to 0");
  }
  
  // Scan I2C bus for all devices
  Serial.println("Scanning I2C bus...");
  int devicesFound = 0;
  for (byte address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    byte error = Wire.endTransmission();
    
    if (error == 0) {
      Serial.printf("I2C device found at address 0x%02X\n", address);
      devicesFound++;
    }
  }
  
  if (devicesFound == 0) {
    Serial.println("No I2C devices found. Check wiring and power.");
  } else {
    Serial.printf("Found %d I2C device(s)\n", devicesFound);
  }
  
  // Initialize BLE with the loaded device name
  Serial.printf("[Boot] Initializing BLE with device name: '%s'\n", deviceName.c_str());
  setupBLE();
  
  // Initialize Discovery Mode GPIO
  pinMode(DISCOVERY_BUTTON_PIN, INPUT_PULLUP);  // Button with internal pullup
  pinMode(DISCOVERY_LED_PIN, OUTPUT);           // LED output
  digitalWrite(DISCOVERY_LED_PIN, LOW);         // Start with LED off
  Serial.printf("[Boot] Discovery button: GPIO%d, LED: GPIO%d\n", DISCOVERY_BUTTON_PIN, DISCOVERY_LED_PIN);
  
  // Test button reading at startup
  int buttonTest = digitalRead(DISCOVERY_BUTTON_PIN);
  Serial.printf("[Boot] Button test reading: %d (%s)\n", buttonTest, buttonTest == HIGH ? "NOT PRESSED" : "PRESSED");
  Serial.println("[Boot] Press discovery button to toggle BLE discovery mode");
  
  // IMPORTANT: Start discovery mode automatically on boot
  Serial.println("[Boot] Auto-starting discovery mode for 5 minutes...");
  startDiscoveryMode();
  
  // Initialize GPS module
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  Serial.println("GPS module initialized");
  
  // Initialize RS485 for wind sensor with ModbusMaster
  // Try both sensor configurations - start with 9600 baud format first
  rs485.begin(9600, SERIAL_8E1, RS485_RX, RS485_TX); // Ultrasonic sensor (9600,8E1,IEEE754)
  pinMode(RS485_DE, OUTPUT);
  digitalWrite(RS485_DE, LOW);
  
  windSensor.begin(1, rs485); // Sensor ID 1
  windSensor.preTransmission(preTransmission);
  windSensor.postTransmission(postTransmission);
  
  // Set shorter timeout to prevent long delays - default is often 2000ms
  windSensor.idle([]() {
    // Allow other tasks during Modbus idle time
    yield();
  });
  
  // Try to set a shorter timeout if the library supports it
  // Note: Not all ModbusMaster versions support this
  #ifdef MODBUS_RESPONSE_TIMEOUT
  windSensor.setResponseTimeout(500); // 500ms timeout instead of default 2000ms
  #endif
  
  Serial.println("RS485 wind sensor initialized with ModbusMaster");
  Serial.printf("RS485 pins: RX=%d, TX=%d, DE=%d\n", RS485_RX, RS485_TX, RS485_DE);
  Serial.println("RS485 settings: Auto-detect between IEEE754 float (9600,8E1) and integer (4800,8N1) formats");
  Serial.println("Anemometer format: Auto-detect between IEEE 754 float and integer data types");
  
  // Test wind sensor connection
  delay(1000);
  Serial.println("Testing wind sensor connection...");
  
  float testSpeed;
  int testDirection;
  bool testResult = readWindSensor(testSpeed, testDirection);
  if (testResult) {
    Serial.printf("Wind sensor test PASSED: %.2f m/s (%.1f kt) @ %d°\n", 
                  testSpeed, testSpeed * 1.944, testDirection);
  } else {
    Serial.println("Wind sensor test FAILED - check connections and power");
  }
  
  Serial.println("Setup complete");
}

void loop() {
  // Handle discovery button and mode
  handleDiscoveryButton();
  updateDiscoveryStatus();
  
  // Handle OTA progress LED blinking using official component
  if (bleOTAActive) {
    unsigned long currentTime = millis();
    
    // Periodic status reporting (every 5 seconds)
    static unsigned long lastStatusReport = 0;
    if (currentTime - lastStatusReport > 5000) {
      unsigned long elapsedMinutes = (currentTime - otaStartTime) / 60000;
      Serial.printf("[BLE OTA] Status: Active for %lu ms (%lu minutes) using official Espressif component\n", 
                   currentTime - otaStartTime, elapsedMinutes);
      
      // Warn when approaching timeout (at 50 minutes)
      if (elapsedMinutes >= 50) {
        Serial.printf("[BLE OTA] WARNING: Approaching timeout in %lu minutes\n", 60 - elapsedMinutes);
      }
      
      lastStatusReport = currentTime;
    }
    
    // Check for total OTA timeout (60 minutes - allow for very large firmware and slow BLE)
    if (currentTime - otaStartTime > 3600000) { // 60 minutes
      Serial.printf("[BLE OTA] Total timeout after %lu ms (%lu minutes). Component will handle cleanup.\n", 
                   currentTime - otaStartTime, (currentTime - otaStartTime) / 60000);
      bleOTAActive = false;
      otaStartTime = 0;
      
      // Turn off LED and resume normal operation
      digitalWrite(DISCOVERY_LED_PIN, LOW);
      Serial.println("[BLE OTA] Timeout recovery complete - resuming sensor data transmission");
      return;
    }
    
    static unsigned long lastOTABlink = 0;
    if (millis() - lastOTABlink >= 100) { // Very fast blink every 100ms
      digitalWrite(DISCOVERY_LED_PIN, !digitalRead(DISCOVERY_LED_PIN));
      lastOTABlink = millis();
    }
    delay(10); // Small delay to prevent tight loop, but keep responsive
    return;
  }
  
  // Check if it's time to update data
  if (millis() >= nextUpdate) {
    // Read sensor data
    readSensors();
    
    // Calculate regatta data if start line is set
    calculateRegattaData();
    
    // Update BLE RSSI if connected
    updateBLERSSI();
    
    // Update BLE clients with sensor data
    updateBLEData();
    
    // Set next update time
    nextUpdate = millis() + refreshRate;
    
    // Print concise status summary every 5 seconds
    static unsigned long lastStatusTime = 0;
    if (millis() - lastStatusTime > 5000) {
      Serial.print("Status: ");
      if (deviceConnected) {
        Serial.printf("BLE✓(%d) ", connectedDeviceCount);
        if (bleRSSIFiltered != 0) Serial.printf("RSSI:%ddBm ", bleRSSIFiltered);
      }
      if (discoveryModeActive) {
        unsigned long remaining = (DISCOVERY_TIMEOUT_MS - (millis() - discoveryModeStartTime)) / 1000;
        Serial.printf("Discovery:%lus ", remaining);
      }
      if (!isnan(currentData.speed) && currentData.speed > 0) 
        Serial.printf("Spd:%.1fkt ", currentData.speed);
      if (!isnan(currentData.windSpeed)) 
        Serial.printf("Wind:%.1fkt AWA:%d° ", currentData.windSpeed, currentData.windAngle);
      if (!isnan(currentData.tilt)) 
        Serial.printf("Tilt:%.1f° ", currentData.tilt);
      if (currentData.HDM >= 0 && currentData.HDM <= 359) 
        Serial.printf("Hdm:%d° ", currentData.HDM);
      
      // GPS status - only show satellite count if we have actual GPS data
      if (gps.charsProcessed() > 10) {
        // We're receiving GPS data
        if (isGPSDataValid()) {
          Serial.printf("GPS:%dsat✓ ", gps.satellites.value());
        } else if (gps.satellites.isValid()) {
          Serial.printf("GPS:%dsat(no fix) ", gps.satellites.value());
        } else {
          Serial.print("GPS:parsing ");
        }
      } else {
        // No GPS data being received
        Serial.print("GPS:no data ");
      }
      
      Serial.println();
      lastStatusTime = millis();
    }
  }
}

// GPS track-based filtering variables
const int GPS_TRACK_BUFFER_SIZE = 10;  // Track last 10 positions
struct GPSPoint {
  double lat;
  double lon;
  float speed;
  unsigned long timestamp;
  bool valid;
};

// Accelerometer-based movement detection variables
const int ACCEL_BUFFER_SIZE = 8;  // Track last 8 acceleration readings
struct AccelPoint {
  float x, y, z;
  float magnitude;
  unsigned long timestamp;
  bool valid;
};

static GPSPoint gpsTrackBuffer[GPS_TRACK_BUFFER_SIZE];
static int gpsTrackIndex = 0;
static bool gpsTrackBufferFull = false;
static float lastValidSpeed = 0.0;

static AccelPoint accelBuffer[ACCEL_BUFFER_SIZE];
static int accelIndex = 0;
static bool accelBufferFull = false;

// Calculate distance between two GPS points in meters
float calculateDistance(double lat1, double lon1, double lat2, double lon2) {
  const float R = 6371000; // Earth's radius in meters
  float dLat = (lat2 - lat1) * PI / 180.0;
  float dLon = (lon2 - lon1) * PI / 180.0;
  float a = sin(dLat/2) * sin(dLat/2) +
            cos(lat1 * PI / 180.0) * cos(lat2 * PI / 180.0) *
            sin(dLon/2) * sin(dLon/2);
  float c = 2 * atan2(sqrt(a), sqrt(1-a));
  return R * c;
}

// Calculate bearing between two GPS points in degrees
float calculateBearing(double lat1, double lon1, double lat2, double lon2) {
  float dLon = (lon2 - lon1) * PI / 180.0;
  float y = sin(dLon) * cos(lat2 * PI / 180.0);
  float x = cos(lat1 * PI / 180.0) * sin(lat2 * PI / 180.0) -
            sin(lat1 * PI / 180.0) * cos(lat2 * PI / 180.0) * cos(dLon);
  float bearing = atan2(y, x) * 180.0 / PI;
  return fmod(bearing + 360.0, 360.0);
}

// Store accelerometer reading for movement analysis
void storeAccelReading(float accelX, float accelY, float accelZ) {
  if (!imuAvailable) return;
  
  AccelPoint point;
  point.x = accelX;
  point.y = accelY;
  point.z = accelZ;
  point.magnitude = sqrt(accelX * accelX + accelY * accelY + accelZ * accelZ);
  point.timestamp = millis();
  point.valid = true;
  
  accelBuffer[accelIndex] = point;
  accelIndex = (accelIndex + 1) % ACCEL_BUFFER_SIZE;
  
  if (!accelBufferFull && accelIndex == 0) {
    accelBufferFull = true;
  }
}

// Analyze accelerometer data to detect movement
bool isAccelerometerMovementDetected() {
  if (!imuAvailable || (!accelBufferFull && accelIndex < 3)) {
    return false; // Not enough data or no IMU
  }
  
  static unsigned long lastAnalysisTime = 0;
  static bool lastResult = false;
  
  // Only analyze every 500ms to reduce CPU load
  if (millis() - lastAnalysisTime < 500) {
    return lastResult;
  }
  lastAnalysisTime = millis();
  
  int validPoints = accelBufferFull ? ACCEL_BUFFER_SIZE : accelIndex;
  if (validPoints < 3) return false;
  
  // Calculate acceleration variance to detect movement
  float totalMagnitude = 0.0;
  float maxMagnitude = 0.0;
  float minMagnitude = 1000.0;
  
  for (int i = 0; i < validPoints; i++) {
    int idx = (accelIndex - validPoints + i + ACCEL_BUFFER_SIZE) % ACCEL_BUFFER_SIZE;
    if (!accelBuffer[idx].valid) continue;
    
    float mag = accelBuffer[idx].magnitude;
    totalMagnitude += mag;
    maxMagnitude = max(maxMagnitude, mag);
    minMagnitude = min(minMagnitude, mag);
  }
  
  float avgMagnitude = totalMagnitude / validPoints;
  float magnitudeRange = maxMagnitude - minMagnitude;
  
  // Calculate standard deviation of acceleration magnitude
  float variance = 0.0;
  for (int i = 0; i < validPoints; i++) {
    int idx = (accelIndex - validPoints + i + ACCEL_BUFFER_SIZE) % ACCEL_BUFFER_SIZE;
    if (!accelBuffer[idx].valid) continue;
    
    float diff = accelBuffer[idx].magnitude - avgMagnitude;
    variance += diff * diff;
  }
  variance /= validPoints;
  float stdDev = sqrt(variance);
  
  // Movement detection thresholds
  const float MOVEMENT_STD_DEV_THRESHOLD = 0.5;  // m/s² - acceleration variation indicating movement
  const float MOVEMENT_RANGE_THRESHOLD = 1.0;    // m/s² - total acceleration range indicating movement
  const float MIN_AVERAGE_ACCEL = 8.0;           // m/s² - minimum for valid readings (gravity ~9.81)
  const float MAX_AVERAGE_ACCEL = 12.0;          // m/s² - maximum for valid readings
  
  // Check if accelerometer readings are reasonable (detecting presence of gravity)
  bool validAccelData = (avgMagnitude >= MIN_AVERAGE_ACCEL && avgMagnitude <= MAX_AVERAGE_ACCEL);
  
  // Movement detected if significant variation in acceleration
  bool movementDetected = validAccelData && 
                         (stdDev > MOVEMENT_STD_DEV_THRESHOLD || magnitudeRange > MOVEMENT_RANGE_THRESHOLD);
  
  #ifdef DEBUG_GPS
  static unsigned long lastAccelDebugTime = 0;
  if (millis() - lastAccelDebugTime > 2000) { // Debug every 2 seconds
    Serial.printf("[Accel Movement] Avg: %.2f m/s², StdDev: %.2f, Range: %.2f, Movement: %s\n",
                  avgMagnitude, stdDev, magnitudeRange, movementDetected ? "YES" : "NO");
    lastAccelDebugTime = millis();
  }
  #endif
  
  lastResult = movementDetected;
  return movementDetected;
}

// Analyze GPS track to determine if movement is real
bool isMovementConsistent() {
  static unsigned long lastAnalysisTime = 0;
  static bool lastResult = false;
  
  // Only analyze movement every 2 seconds to reduce CPU load
  if (millis() - lastAnalysisTime < 2000) {
    return lastResult;
  }
  lastAnalysisTime = millis();
  
  if (!gpsTrackBufferFull && gpsTrackIndex < 3) {
    lastResult = false;
    return false; // Need at least 3 points
  }
  
  int validPoints = gpsTrackBufferFull ? GPS_TRACK_BUFFER_SIZE : gpsTrackIndex;
  if (validPoints < 3) {
    lastResult = false;
    return false;
  }
  
  // Calculate total distance and bearing changes
  float totalDistance = 0.0;
  float totalBearingChange = 0.0;
  float lastBearing = 0.0;
  bool firstBearing = true;
  int consecutivePoints = 0;
  
  for (int i = 1; i < validPoints; i++) {
    int prevIdx = (gpsTrackIndex - validPoints + i - 1 + GPS_TRACK_BUFFER_SIZE) % GPS_TRACK_BUFFER_SIZE;
    int currIdx = (gpsTrackIndex - validPoints + i + GPS_TRACK_BUFFER_SIZE) % GPS_TRACK_BUFFER_SIZE;
    
    if (!gpsTrackBuffer[prevIdx].valid || !gpsTrackBuffer[currIdx].valid) continue;
    
    float distance = calculateDistance(
      gpsTrackBuffer[prevIdx].lat, gpsTrackBuffer[prevIdx].lon,
      gpsTrackBuffer[currIdx].lat, gpsTrackBuffer[currIdx].lon
    );
    
    totalDistance += distance;
    consecutivePoints++;
    
    if (distance > 2.0) { // Only calculate bearing for significant movement
      float bearing = calculateBearing(
        gpsTrackBuffer[prevIdx].lat, gpsTrackBuffer[prevIdx].lon,
        gpsTrackBuffer[currIdx].lat, gpsTrackBuffer[currIdx].lon
      );
      
      if (!firstBearing) {
        float bearingDiff = fabs(bearing - lastBearing);
        if (bearingDiff > 180) bearingDiff = 360 - bearingDiff;
        totalBearingChange += bearingDiff;
      }
      
      lastBearing = bearing;
      firstBearing = false;
    }
  }
  
  if (consecutivePoints < 2) return false;
  
  // Calculate average distance per sample
  float avgDistance = totalDistance / consecutivePoints;
  
  // If we're moving very little, check for GPS noise pattern
  if (avgDistance < 3.0) { // Less than 3 meters per sample = likely stationary
    return false;
  }
  
  // If we're moving significantly, check for consistent track
  if (avgDistance > 5.0) { // More than 5 meters per sample = likely real movement
    // Check if bearing changes are reasonable (not jumping around randomly)
    float avgBearingChange = totalBearingChange / max(1, consecutivePoints - 1);
    
    // Allow for reasonable course changes in sailing
    if (avgBearingChange < 45.0) { // Less than 45° average change = consistent track
      lastResult = true;
      return true;
    }
  }
  
  lastResult = false;
  return false;
}

// Enhanced GPS speed filtering with accelerometer data
float filterGPSSpeed(float rawSpeed, int satellites, float hdop) {
  // Basic GPS quality check - less strict than before
  bool goodGPSQuality = (satellites >= 4 && hdop <= 3.0);
  
  // If GPS quality is very poor, don't trust readings
  if (!goodGPSQuality) {
    return lastValidSpeed * 0.95; // Gradually decay speed if no GPS
  }
  
  // Store current GPS point in track buffer
  GPSPoint currentPoint;
  currentPoint.lat = gps.location.lat();
  currentPoint.lon = gps.location.lng();
  currentPoint.speed = rawSpeed;
  currentPoint.timestamp = millis();
  currentPoint.valid = gps.location.isValid();
  
  gpsTrackBuffer[gpsTrackIndex] = currentPoint;
  gpsTrackIndex = (gpsTrackIndex + 1) % GPS_TRACK_BUFFER_SIZE;
  
  if (!gpsTrackBufferFull && gpsTrackIndex == 0) {
    gpsTrackBufferFull = true;
  }
  
  // Basic speed smoothing with smaller window
  const int SPEED_SMOOTH_SIZE = 3;
  float speedSum = 0.0;
  int speedCount = 0;
  
  for (int i = 0; i < SPEED_SMOOTH_SIZE && i < (gpsTrackBufferFull ? GPS_TRACK_BUFFER_SIZE : gpsTrackIndex); i++) {
    int idx = (gpsTrackIndex - 1 - i + GPS_TRACK_BUFFER_SIZE) % GPS_TRACK_BUFFER_SIZE;
    if (gpsTrackBuffer[idx].valid) {
      speedSum += gpsTrackBuffer[idx].speed;
      speedCount++;
    }
  }
  
  float smoothedSpeed = speedCount > 0 ? speedSum / speedCount : rawSpeed;
  
  // Enhanced movement detection combining GPS track and accelerometer
  bool gpsMovementDetected = isMovementConsistent();
  bool accelMovementDetected = isAccelerometerMovementDetected();
  
  // Combined movement detection logic
  bool realMovementDetected = false;
  
  if (imuAvailable) {
    // When IMU is available, use both GPS and accelerometer
    // Movement confirmed if EITHER sensor detects movement (OR logic for sensitivity)
    // But both must agree for stationary state (AND logic for stability)
    if (gpsMovementDetected || accelMovementDetected) {
      realMovementDetected = true;
    } else {
      // Both sensors agree: no movement
      realMovementDetected = false;
    }
  } else {
    // Fall back to GPS-only detection when no IMU
    realMovementDetected = gpsMovementDetected;
  }
  
  // Adaptive noise threshold based on movement detection confidence
  float noiseThreshold = 0.08; // Base threshold: 0.08 knots
  
  if (imuAvailable && accelMovementDetected && gpsMovementDetected) {
    // Both sensors confirm movement - lower threshold for better sensitivity
    noiseThreshold = 0.05; // More sensitive when movement is confirmed
  } else if (imuAvailable && !accelMovementDetected && !gpsMovementDetected) {
    // Both sensors confirm stationary - higher threshold to filter noise
    noiseThreshold = 0.12; // Less sensitive when stationary is confirmed
  }
  
  if (smoothedSpeed < noiseThreshold) {
    if (realMovementDetected) {
      // Movement detected by sensors, trust the GPS speed even if low
      lastValidSpeed = smoothedSpeed;
      return smoothedSpeed;
    } else {
      // No movement detected, likely stationary or GPS noise
      lastValidSpeed = 0.0;
      return 0.0;
    }
  }
  
  // For higher speeds, use lighter filtering with hysteresis
  const float HYSTERESIS_FACTOR = 0.1; // 10% hysteresis
  
  if (lastValidSpeed < noiseThreshold) {
    // Was stationary, need slightly higher speed to register movement
    if (smoothedSpeed > (noiseThreshold + HYSTERESIS_FACTOR)) {
      lastValidSpeed = smoothedSpeed;
      return smoothedSpeed;
    } else {
      return 0.0;
    }
  } else {
    // Was moving, use current speed with minimal filtering
    lastValidSpeed = smoothedSpeed;
    return smoothedSpeed;
  }
}

// Read sensor data
void readSensors() {
  #ifdef DEBUG_BLE_DATA
  unsigned long startTime = millis();
  #endif
  
  // Read GPS data first
  bool gpsDataValid = readGPS();
  
  #ifdef DEBUG_BLE_DATA
  unsigned long gpsTime = millis();
  #endif
  
  // Apply track-based GPS speed filtering
  if (gpsDataValid && gps.speed.isValid()) {
    static unsigned long lastGPSDebugTime = 0;
    
    float rawSpeed = gps.speed.knots();
    int satellites = gps.satellites.isValid() ? gps.satellites.value() : 0;
    float hdop = gps.hdop.isValid() ? gps.hdop.hdop() : 99.9;
    
    // Use enhanced GPS filtering with accelerometer data
    currentData.speed = filterGPSSpeed(rawSpeed, satellites, hdop);
    
    #ifdef DEBUG_GPS
    Serial.printf("[GPS Filter] Raw: %.2f, Filtered: %.2f, Sats: %d, HDOP: %.1f, GPS Track: %s, Accel: %s\n", 
                  rawSpeed, currentData.speed, satellites, hdop,
                  isMovementConsistent() ? "MOVING" : "STATIONARY",
                  imuAvailable ? (isAccelerometerMovementDetected() ? "MOVING" : "STATIONARY") : "N/A");
    #endif
    
    // Additional debug for enhanced movement detection (always show when speed > 0.3 knots raw)
    if (rawSpeed > 0.3) {
      Serial.printf("[Enhanced GPS] Raw: %.3f kt, Filtered: %.3f kt, GPS: %s, Accel: %s\n", 
                    rawSpeed, currentData.speed, 
                    isMovementConsistent() ? "MOVING" : "STATIONARY",
                    imuAvailable ? (isAccelerometerMovementDetected() ? "MOVING" : "STATIONARY") : "N/A");
    }
  } else {
    currentData.speed = 0.0;
  }

  #ifdef DEBUG_BLE_DATA
  unsigned long filterTime = millis();
  #endif

  // Read wind sensor using ModbusMaster
  float sensorWindSpeed;
  int sensorWindAngle;
  if (readWindSensor(sensorWindSpeed, sensorWindAngle)) {
    // Speed is already in m/s from the sensor, convert to knots (1 m/s = 1.944 knots)
    currentData.windSpeed = sensorWindSpeed * 1.944;
    
    // Store wind angle directly (0-360°)
    currentData.windAngle = sensorWindAngle;
    
    #ifdef DEBUG_WIND_SENSOR
    Serial.printf("Wind: %.1f kt @ %d°\\n", currentData.windSpeed, currentData.windAngle);
    #endif
  } else {
    currentData.windSpeed = NAN;
    currentData.windAngle = -999; // Use clearly invalid value (not -1 which could be valid)
    // Only show error once every 10 seconds to avoid spam
    static unsigned long lastErrorTime = 0;
    if (millis() - lastErrorTime > 10000) {
      Serial.println("Wind sensor read failed");
      lastErrorTime = millis();
    }
  }
  
  #ifdef DEBUG_BLE_DATA
  unsigned long windTime = millis();
  #endif
  
  // Enhanced GPS debug output (only when needed)
  #ifdef DEBUG_GPS
  Serial.print("[GPS Debug] TinyGPS++ chars processed: ");
  Serial.print(gps.charsProcessed());
  Serial.print(", Sentences with fix: ");
  Serial.print(gps.sentencesWithFix());
  Serial.print(", Satellites: ");
  Serial.print(gps.satellites.value());
  Serial.print(", HDOP: ");
  Serial.print(gps.hdop.value());
  Serial.print(", Age: ");
  Serial.print(gps.location.age());
  Serial.print(" ms");
  if (gps.location.isValid() && gps.speed.isValid() && gps.satellites.value() >= 5) {
    Serial.print(" | GPS FIX: Lat: ");
    Serial.print(gps.location.lat(), 6);
    Serial.print(", Lng: ");
    Serial.print(gps.location.lng(), 6);
    Serial.print(", Speed: ");
    Serial.print(gps.speed.knots(), 2);
    Serial.println(" knots");
  } else {
    Serial.println(" | No valid GPS fix or insufficient satellites");
  }
  #endif
  // Optionally, print raw NMEA sentences for troubleshooting
  // while (gpsSerial.available() > 0) {
  //   char c = gpsSerial.read();
  //   Serial.write(c);
  // }
  
  // Calculate true wind: if speed is very low, set true wind = apparent wind
  const float SPEED_THRESHOLD = 0.5; // knots
  if (!isnan(currentData.windSpeed) && currentData.windAngle >= 0 && currentData.windAngle <= 359) {
    if (!isnan(currentData.speed) && currentData.speed >= SPEED_THRESHOLD) {
      // We have valid speed and wind data - calculate true wind
      calculateTrueWind(currentData.speed, currentData.windAngle, currentData.windSpeed,
                        currentData.trueWindSpeed, currentData.trueWindAngle);
    } else {
      // Boat is stationary or moving very slowly: true wind = apparent wind
      currentData.trueWindSpeed = currentData.windSpeed;
      currentData.trueWindAngle = currentData.windAngle;
    }
  } else {
    currentData.trueWindSpeed = NAN;
    currentData.trueWindAngle = -999;
  }
  
  // Read tilt from BNO080 (only if available)
  if (imuAvailable) {
    static unsigned long lastIMURead = 0;
    const unsigned long IMU_READ_INTERVAL = 20; // Read IMU every 20ms (50Hz to match magnetometer)
    
    if (millis() - lastIMURead >= IMU_READ_INTERVAL) {
      lastIMURead = millis();
      
      if (imu.dataAvailable()) {
        // dataAvailable() processes incoming sensor reports from BNO080
        // It updates internal variables: rawAccelX/Y/Z, rawMagX/Y/Z, rawQuatI/J/K/Real
        
        // **USE ACCELEROMETER FOR FAST HEEL/PITCH CALCULATION**
        // The rotation vector (quaternion) updates too slowly (~4-6 seconds)
        // Accelerometer updates fast and reliably every cycle
        
        // Get accelerometer readings (in m/s²)
        float accelX = imu.getAccelX();
        float accelY = imu.getAccelY();
        float accelZ = imu.getAccelZ();
        
        // Calculate heel (roll) from gravity vector
        // When level: accelZ ≈ 9.8, accelX ≈ 0, accelY ≈ 0
        // When heeled right: accelX increases (positive), accelZ decreases
        float rawRoll = atan2(accelX, sqrt(accelY * accelY + accelZ * accelZ)) * 180.0f / PI;
        
        // Calculate pitch from gravity vector  
        float rawPitch = atan2(accelY, sqrt(accelX * accelX + accelZ * accelZ)) * 180.0f / PI;
        
        // Apply calibration offsets
        float roll = rawRoll - rollOffset;
        float pitch = rawPitch - pitchOffset;
        
        currentData.tilt = roll;
        currentData.pitch = pitch;
        
        #ifdef DEBUG_BNO080
        if (levelCalibrated) {
          Serial.printf("[BNO080] Accel-based - Raw: R=%.2f° P=%.2f° → Heel: %.2f° Pitch: %.2f°\n", 
                       rawRoll, rawPitch, roll, pitch);
        } else {
          Serial.printf("[BNO080] Uncalibrated - Heel: %.2f° Pitch: %.2f°\n", roll, pitch);
        }
        #endif
        
        // Compass calculation - only update when magnetometer actually changes
        // **USE ROTATION VECTOR FOR TILT-COMPENSATED COMPASS**
        // BNO080's rotation vector fuses gyro + accel + mag - heading is tilt-compensated!
        float quatI = imu.getQuatI();
        float quatJ = imu.getQuatJ();
        float quatK = imu.getQuatK();
        float quatReal = imu.getQuatReal();
        
        // Check if quaternion is valid (non-zero)
        float quatMag = sqrt(quatI*quatI + quatJ*quatJ + quatK*quatK + quatReal*quatReal);
        
        if (quatMag > 0.1) {
          // Extract ONLY heading (yaw) from quaternion
          // This is the magnetic north-referenced heading, tilt-compensated by sensor fusion
          float heading = atan2(2.0f * (quatI*quatJ + quatReal*quatK),
                               quatReal*quatReal + quatI*quatI - quatJ*quatJ - quatK*quatK);
          heading = heading * 180.0f / PI;
          if (heading < 0) heading += 360.0f;
          
          // Apply calibration offset
          if (northCalibrated) {
            heading = heading - headingOffset;
            if (heading < 0) heading += 360.0f;
            if (heading >= 360) heading -= 360.0f;
          }
          
          currentData.HDM = (int)round(heading);
          
          #ifdef DEBUG_BNO080
          Serial.printf("[BNO080] Heading from rotation vector: %.1f° → Calibrated: %d°\n", 
                       heading + (northCalibrated ? headingOffset : 0), currentData.HDM);
          #endif
        } else {
          #ifdef DEBUG_BNO080
          Serial.println("[BNO080] Rotation vector not ready");
          #endif
        }
        
        // Read accelerometer data
        currentData.accelX = imu.getAccelX();
        currentData.accelY = imu.getAccelY();
        currentData.accelZ = imu.getAccelZ();
        
        // Store accelerometer data for movement analysis
        storeAccelReading(currentData.accelX, currentData.accelY, currentData.accelZ);
        
        #ifdef DEBUG_BNO080
        static unsigned long lastAccelDebug = 0;
        if (millis() - lastAccelDebug > 2000) { // Debug every 2 seconds
          Serial.printf("[BNO080] Accel: X=%.2f Y=%.2f Z=%.2f m/s²\n", 
                        currentData.accelX, currentData.accelY, currentData.accelZ);
          lastAccelDebug = millis();
        }
        #endif
        
      } else {
        // No new data available
        static unsigned long lastNoDataWarning = 0;
        if (millis() - lastNoDataWarning > 30000) { // Warn every 30 seconds
          Serial.println("[BNO080] Warning: No new data available");
          lastNoDataWarning = millis();
        }
      }
    }
  } else {
    // IMU not available - set all values to 0/NaN
    currentData.tilt = 0.0;
    currentData.HDM = -1; // Use -1 to indicate invalid heading
    currentData.accelX = NAN;
    currentData.accelY = NAN;
    currentData.accelZ = NAN;
  }
  
  #ifdef DEBUG_BLE_DATA
  unsigned long endTime = millis();
  static unsigned long lastTimingReport = 0;
  if (millis() - lastTimingReport > 5000) { // Report timing every 5 seconds
    Serial.printf("[Timing] Total: %lums, GPS: %lums, Filter: %lums, Wind: %lums, IMU: %lums\n",
                  endTime - startTime,
                  gpsTime - startTime,
                  filterTime - gpsTime, 
                  windTime - filterTime,
                  endTime - windTime);
    lastTimingReport = millis();
  }
  #endif
}

// Generate JSON string with current sensor data using marine standard terminology
String getSensorDataJson() {
  DynamicJsonDocument doc(512); // Enough for full telemetry and regatta fields
  
  // Core sailing data (rounded to reduce JSON size)
  doc["SOG"] = round((isnan(currentData.speed) ? 0.0 : currentData.speed) * 10) / 10.0; // Speed Over Ground
  
  // GPS coordinates (reduced precision for BLE efficiency)
  if (gps.location.isValid()) {
    doc["lat"] = round(gps.location.lat() * 100000) / 100000.0; // 5 decimal places
    doc["lon"] = round(gps.location.lng() * 100000) / 100000.0; // 5 decimal places
  } else {
    doc["lat"] = 0.0;
    doc["lon"] = 0.0;
  }
  
  if (gps.course.isValid()) {
    doc["COG"] = round(gps.course.deg()); // Course Over Ground (integer)
  } else {
    doc["COG"] = 0;
  }
  
  // GPS quality indicators
  doc["sat"] = (gps.charsProcessed() > 10 && gps.satellites.isValid()) ? gps.satellites.value() : 0;
  
  if (gps.hdop.isValid()) {
    doc["hdop"] = round(gps.hdop.hdop() * 10) / 10.0; // 1 decimal place
  } else {
    doc["hdop"] = 99.9; // Invalid HDOP value
  }
  
  // Wind data - only include if sensor is connected and working
  if (!isnan(currentData.windSpeed)) {
    doc["AWS"] = round(currentData.windSpeed * 10) / 10.0; // Apparent Wind Speed (1 decimal)
  }
  
  // Wind angle data (apparent wind angle in full 360° range)
  if (currentData.windAngle >= 0 && currentData.windAngle <= 359) {
    doc["AWA"] = round(currentData.windAngle); // Apparent Wind Angle (integer, 0-359°)
  }
  
  // True wind data - only include if calculated successfully
  if (!isnan(currentData.trueWindSpeed)) {
    doc["TWS"] = round(currentData.trueWindSpeed * 10) / 10.0; // True Wind Speed (1 decimal)
  }
  
  // True wind angle data 
  if (currentData.trueWindAngle >= 0 && currentData.trueWindAngle <= 359) {
    doc["TWA"] = round(currentData.trueWindAngle); // True Wind Angle (integer, 0-359°)
  }
  
  // Heel angle - only include if IMU is available
  if (imuAvailable && !isnan(currentData.tilt)) {
    doc["hl"] = round(currentData.tilt); // Vessel heel angle (integer)
  }
  
  // Pitch angle - only include if IMU is available
  if (imuAvailable && !isnan(currentData.pitch)) {
    doc["pitch"] = round(currentData.pitch * 10) / 10.0; // Vessel pitch angle (1 decimal)
  }
  
  // Magnetic heading - only include if IMU is available and has valid data
  if (imuAvailable && currentData.HDM >= 0 && currentData.HDM <= 359) {
    doc["HDM"] = round(currentData.HDM); // Magnetic heading in degrees (integer)
  }
  
  // Acceleration data - only include if IMU is available and has valid data
  if (imuAvailable && !isnan(currentData.accelX)) {
    doc["accelX"] = round(currentData.accelX * 100) / 100.0; // Acceleration X-axis in m/s² (2 decimals)
    doc["accelY"] = round(currentData.accelY * 100) / 100.0; // Acceleration Y-axis in m/s² (2 decimals)
    doc["accelZ"] = round(currentData.accelZ * 100) / 100.0; // Acceleration Z-axis in m/s² (2 decimals)
  }
  
  // BLE connection quality (smoothed RSSI for stable readings)
  doc["rssi"] = bleRSSIFiltered;
  
  // Regatta data - send ln if start line is configured and GPS valid
  // Negative = behind line (pre-start), Positive = crossed line, Zero = on line
  if (regattaData.hasStartLine && !isnan(regattaData.distanceToLine)) {
    doc["ln"] = round(regattaData.distanceToLine); // Distance in meters (integer)
  }
  
  String output;
  serializeJson(doc, output);
  // If output still exceeds safe limit, caller will attempt reduction
  return output;
}

// Wind Sensor Functions

// Convert two Modbus registers (32 bits) to float
float regsToFloat(uint16_t lowReg, uint16_t highReg) {
  uint32_t combined = ((uint32_t)highReg << 16) | lowReg;
  float value;
  memcpy(&value, &combined, sizeof(value));
  return value;
}

// Read wind sensor data via RS485 using ModbusMaster
bool readWindSensor(float &windSpeed, int &windAngle) {
  static unsigned long lastAttempt = 0;
  static bool sensorTypeDetected = false;
  static bool useIEEE754Format = true; // true = IEEE754 float (9600,8E1), false = integer (4800,8N1)
  
  // Don't hammer the sensor - minimum 100ms between attempts
  if (millis() - lastAttempt < 100) {
    return false;
  }
  lastAttempt = millis();
  
  #ifdef DEBUG_WIND_SENSOR
  Serial.print("[Wind Sensor] Reading ");
  if (useIEEE754Format) {
    Serial.print("IEEE754 format (9600,8E1,float)... ");
  } else {
    Serial.print("integer format (4800,8N1,int)... ");
  }
  unsigned long modbusStart = millis();
  #endif
  
  // Clear any existing response data
  windSensor.clearResponseBuffer();
  
  uint8_t result;
  
  if (useIEEE754Format) {
    // IEEE754 ultrasonic sensor: Read registers 0x0001 for 4 registers (direction + speed float)
    result = windSensor.readHoldingRegisters(0x0001, 4);
  } else {
    // Integer ultrasonic sensor: Read registers 0x0000 for 2 registers (speed int + direction)  
    result = windSensor.readHoldingRegisters(0x0000, 2);
  }

  #ifdef DEBUG_WIND_SENSOR
  unsigned long modbusTime = millis() - modbusStart;
  Serial.printf("(took %lums) ", modbusTime);
  #endif

  if (result == windSensor.ku8MBSuccess) {
    
    if (useIEEE754Format) {
      // IEEE754 ultrasonic anemometer format:
      // reg0 = direction (0–359°)
      // reg1 = speed float low word
      // reg2 = speed float high word  
      // reg3 = unused
      
      windAngle = windSensor.getResponseBuffer(0); // direction
      uint16_t speedLow = windSensor.getResponseBuffer(1);
      uint16_t speedHigh = windSensor.getResponseBuffer(2);
      
      // Convert registers to IEEE 754 float
      windSpeed = regsToFloat(speedLow, speedHigh);
      
      #ifdef DEBUG_WIND_SENSOR
      Serial.printf("SUCCESS - IEEE754 format: Direction=%d°, Speed=%.3f m/s (raw: low=%d, high=%d)\n", 
                    windAngle, windSpeed, speedLow, speedHigh);
      #endif
      
      // Validate data - if it looks wrong, try integer format
      if (!sensorTypeDetected && (windAngle < 0 || windAngle > 359 || 
          isnan(windSpeed) || windSpeed < 0 || windSpeed > 50)) {
        #ifdef DEBUG_WIND_SENSOR
        Serial.println("  IEEE754 format data invalid, will try integer format next");
        #endif
        useIEEE754Format = false;
        
        // Reconfigure RS485 for integer sensor
        rs485.end();
        rs485.begin(4800, SERIAL_8N1, RS485_RX, RS485_TX);
        windSensor.begin(1, rs485);
        windSensor.preTransmission(preTransmission);
        windSensor.postTransmission(postTransmission);
        
        return false; // Try again with integer format
      }
      
    } else {
      // Integer ultrasonic anemometer format:
      // reg0 = speed (expanded by 100, e.g., 125 = 1.25 m/s)
      // reg1 = direction (0-359°)
      
      uint16_t speedRaw = windSensor.getResponseBuffer(0);
      windSpeed = speedRaw / 100.0f;
      windAngle = windSensor.getResponseBuffer(1);
      
      #ifdef DEBUG_WIND_SENSOR
      Serial.printf("SUCCESS - integer format: Speed raw=%d (%.2f m/s), Direction=%d°\n", 
                    speedRaw, windSpeed, windAngle);
      #endif
      
      // Validate data - if it looks wrong, try IEEE754 format
      if (!sensorTypeDetected && (windAngle < 0 || windAngle > 359 || windSpeed < 0 || windSpeed > 50)) {
        #ifdef DEBUG_WIND_SENSOR
        Serial.println("  Integer format data invalid, will try IEEE754 format next");
        #endif
        useIEEE754Format = true;
        
        // Reconfigure RS485 for IEEE754 sensor
        rs485.end(); 
        rs485.begin(9600, SERIAL_8E1, RS485_RX, RS485_TX);
        windSensor.begin(1, rs485);
        windSensor.preTransmission(preTransmission);
        windSensor.postTransmission(postTransmission);
        
        return false; // Try again with IEEE754 format
      }
    }
    
    // If we get here with valid data, lock in the sensor type
    if (!sensorTypeDetected && windAngle >= 0 && windAngle <= 359 && 
        windSpeed >= 0 && windSpeed <= 50 && !isnan(windSpeed)) {
      sensorTypeDetected = true;
      Serial.printf("\n[Wind Sensor] Detected %s format and locked it in\n", 
                    useIEEE754Format ? "IEEE754 float" : "integer");
    }
    
    return true;
    
  } else {
    #ifdef DEBUG_WIND_SENSOR
    Serial.printf("ERROR %d - ", result);
    
    // Decode common Modbus error codes
    switch(result) {
      case 0xE0: Serial.println("Invalid slave ID"); break;
      case 0xE1: Serial.println("Invalid function"); break;
      case 0xE2: Serial.println("Response timeout"); break;
      case 0xE3: Serial.println("Invalid CRC"); break;
      default:   
        if (result == 226) {
          Serial.println("Communication timeout/no response");
        } else {
          Serial.printf("Unknown error code\n");
        }
        break;
    }
    
    // If we haven't detected sensor type yet, try the other format
    if (!sensorTypeDetected) {
      useIEEE754Format = !useIEEE754Format;
      #ifdef DEBUG_WIND_SENSOR
      Serial.printf("  Switching to %s format for next attempt\n", 
                    useIEEE754Format ? "IEEE754 float" : "integer");
      #endif
      
      // Reconfigure RS485 for the other sensor type
      rs485.end();
      if (useIEEE754Format) {
        rs485.begin(9600, SERIAL_8E1, RS485_RX, RS485_TX);
      } else {
        rs485.begin(4800, SERIAL_8N1, RS485_RX, RS485_TX);
      }
      windSensor.begin(1, rs485);
      windSensor.preTransmission(preTransmission);
      windSensor.postTransmission(postTransmission);
    }
    #endif
    
    return false;
  }
}

// GPS Functions

// Check if GPS has valid, recent data
bool isGPSDataValid() {
  // Require multiple conditions for valid GPS:
  // 1. Must have processed characters (indicating actual serial data)
  // 2. Must have valid sentences with fix data
  // 3. Location must be valid
  // 4. Data must be recent (less than 5 seconds old)
  // 5. Must have reasonable satellite count (not just noise)
  return gps.charsProcessed() > 10 &&        // Must have processed actual data
         gps.sentencesWithFix() > 0 &&       // Must have valid NMEA sentences
         gps.location.isValid() && 
         gps.location.age() < 5000 && 
         gps.satellites.isValid() &&
         gps.satellites.value() >= 3;         // Minimum for any fix
}

// Read GPS data
bool readGPS() {
  bool newData = false;
  int bytesRead = 0;
  
  // Read available GPS data (but limit to prevent infinite loops)
  while (gpsSerial.available() > 0 && bytesRead < 256) {
    if (gps.encode(gpsSerial.read())) {
      newData = true;
    }
    bytesRead++;
  }
  
  // Return true only if we have valid, recent location data
  return newData && isGPSDataValid();
}

// Regatta Functions

// Validate GPS coordinates are within valid ranges
// Latitude: -90 to +90 degrees
// Longitude: -180 to +180 degrees
bool isValidGPSCoordinates(double lat, double lon) {
  // Check if coordinates are non-zero (0,0 is typically invalid/uninitialized)
  if (lat == 0.0 && lon == 0.0) {
    return false;
  }
  
  // Validate latitude range: -90 to +90
  if (lat < -90.0 || lat > 90.0) {
    Serial.printf("[GPS Validation] Invalid latitude: %.6f (must be -90 to +90)\n", lat);
    return false;
  }
  
  // Validate longitude range: -180 to +180
  if (lon < -180.0 || lon > 180.0) {
    Serial.printf("[GPS Validation] Invalid longitude: %.6f (must be -180 to +180)\n", lon);
    return false;
  }
  
  return true;
}

// Calculate distance between two GPS coordinates using Haversine formula
float haversineDistance(double lat1, double lon1, double lat2, double lon2) {
  const double R = 6371000; // Earth radius in meters
  
  double dLat = (lat2 - lat1) * PI / 180.0;
  double dLon = (lon2 - lon1) * PI / 180.0;
  
  double a = sin(dLat/2) * sin(dLat/2) + 
             cos(lat1 * PI / 180.0) * cos(lat2 * PI / 180.0) * 
             sin(dLon/2) * sin(dLon/2);
  
  double c = 2 * atan2(sqrt(a), sqrt(1-a));
  
  return R * c; // Distance in meters
}

// Calculate perpendicular distance from point to line segment
float distanceToLine(double px, double py, double x1, double y1, double x2, double y2) {
  // Convert GPS coordinates to meters using simple projection for short distances
  // This is accurate enough for regatta start lines (typically < 1km)
  double dx = x2 - x1;
  double dy = y2 - y1;
  
  if (dx == 0 && dy == 0) {
    // Line endpoints are the same, return distance to point
    return haversineDistance(px, py, x1, y1);
  }
  
  // Calculate the t parameter for the closest point on the line
  double t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  
  // Clamp t to [0,1] to stay within the line segment
  t = max(0.0, min(1.0, t));
  
  // Calculate the closest point on the line segment
  double closestX = x1 + t * dx;
  double closestY = y1 + t * dy;
  
  // Return distance to closest point
  return haversineDistance(px, py, closestX, closestY);
}

// Calculate current distance to regatta start line
void calculateRegattaData() {
  if (!regattaData.hasStartLine || !gps.location.isValid()) {
    regattaData.distanceToLine = NAN; // Invalid - no line set or no GPS
    return;
  }
  
  double currentLat = gps.location.lat();
  double currentLon = gps.location.lng();
  
  regattaData.distanceToLine = distanceToLine(currentLat, currentLon,
                                             regattaData.portLat, regattaData.portLon,
                                             regattaData.starboardLat, regattaData.starboardLon);
}