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
#include "wind_sensor.h"
#include "wind_math.h"
#include "ble_payload.h"
#include "ble_payload_validation.h"
#include "discovery_button.h"
#include "discovery_status.h"
#include "ble_random_address.h"
#include "ble_ota_handler.h"
#include "ble_json.h"
#include "ble_send.h"
#include "ble_rssi.h"
#include "ble_command.h"
#include "ble_device_name.h"
#include "sensor_data.h"
#include "gps_validation.h"
#include "imu_math.h"
#include "regatta_math.h"
#include "base64.h"
#include "accel_movement.h"
#include "gps_reader.h"
#include "gps_math.h"
#include "gps_movement.h"
#include "gps_speed_smoothing.h"
#include "gps_speed_filter.h"
#include "ota_chunk.h"
#include "ota_state.h"
#include "ota_timeout.h"
#include "refresh_rate.h"
#include "refresh_rate_calc.h"

// Firmware version
#define FIRMWARE_VERSION "0.0.28"

// Debug flags - uncomment for verbose output
// #define DEBUG_BLE_DATA
#define DEBUG_WIND_SENSOR
#define DEBUG_GPS
#define DEBUG_BNO080

// Persistent storage for settings
Preferences preferences;
int deadWindAngle = 40; // default
float refreshRateSeconds = 1.0f; // Default 1.0 second refresh rate
int refreshRate = 1000; // Refresh rate in milliseconds
bool otaInProgress = false; // Flag to pause sensor data during firmware updates
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
static OtaState otaState;
static BleOtaHandler otaHandler;
extern OtaBackend otaBackend;

#include "board/pins_esp32s3_rlcd.h"
#include "display/display_lvgl.h"
#include "display/display_driver.h"

BNO080 imu;
bool imuAvailable = false; // Track if IMU is working

// Calibration - simple angle offsets (works for arbitrary mounting orientations)
float rollOffset = 0.0;      // Roll offset when level
float pitchOffset = 0.0;     // Pitch offset when level  
float headingOffset = 0.0;   // Heading offset when pointing north
bool levelCalibrated = false;
bool northCalibrated = false;

bool discoveryModeActive = false;
unsigned long discoveryModeStartTime = 0;
DiscoveryButtonState discoveryButtonState;
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
void calculateRegattaData();

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

WindSensorReader<ModbusMaster, HardwareSerial, HardwareSerial> windReader(
    windSensor,
    rs485,
    RS485_RX,
    RS485_TX,
    preTransmission,
    postTransmission,
    millis,
    SERIAL_8E1,
    SERIAL_8N1,
    nullptr  // Serial is USBCDC (not HardwareSerial) with USB_CDC_ON_BOOT
);



// Safe BLE transmission function to prevent data corruption
bool safeBLESend(const String& data, bool isCommand) {
  Serial.printf("[BLE DEBUG] Attempting to send %d chars, command=%s\n", 
               data.length(), isCommand ? "true" : "false");
  Serial.printf("[BLE DEBUG] Connected devices: %d\n", pServer ? pServer->getConnectedCount() : 0);

  auto setValueFn = [](void* characteristic, const uint8_t* value, size_t len) -> bool {
    auto* ch = static_cast<NimBLECharacteristic*>(characteristic);
    try {
      ch->setValue(value, len);
      return true;
    } catch (...) {
      return false;
    }
  };

  auto notifyFn = [](void* characteristic) {
    auto* ch = static_cast<NimBLECharacteristic*>(characteristic);
    ch->notify();
  };

  bool ok = safeBleSendCore(pServer,
                            pServer ? pServer->getConnectedCount() : 0,
                            pSensorDataCharacteristic,
                            bleSending,
                            data,
                            isCommand,
                            millis,
                            reinterpret_cast<void (*)(unsigned long)>(delay),
                            setValueFn,
                            notifyFn);

  if (!ok) {
    Serial.println("[BLE DEBUG] FAILED: Transmission skipped or failed");
  } else {
    Serial.printf("[BLE DEBUG] Delay completed (%d ms)\n", isCommand ? 10 : 5);
  }

  return ok;
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
          BleCommand command;
          parseBleCommandDoc(doc, command);
          
          Serial.printf("[BLE RECV] Parsed JSON - action: '%s', cmd: '%s'\n", 
                       command.action.c_str(), command.cmd.c_str());
          
          // Log OTA-related commands with extra detail
          if (command.cmd == "START_FW_UPDATE" || command.cmd == "FW_CHUNK" || command.cmd == "VERIFY_FW" || command.cmd == "APPLY_FW") {
            Serial.printf("[OTA CMD] Received: %s\n", command.cmd.c_str());
            if (command.cmd == "FW_CHUNK" && command.hasIndex) {
              Serial.printf("[OTA CMD] Chunk index: %d\n", command.index);
            }
          }
          
          if (command.action == "resetHeelAngle") {
            // Calibrate vessel level position (boat is level, any heading)
            if (imuAvailable) {
              if (imu.dataAvailable()) {
                // Get current heel/pitch from accelerometer
                float accelX = imu.getAccelX();
                float accelY = imu.getAccelY();
                float accelZ = imu.getAccelZ();
                
                float currentRoll = 0.0f;
                float currentPitch = 0.0f;
                computeRollPitchDegrees(accelX, accelY, accelZ, currentRoll, currentPitch);
                
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
          else if (command.action == "resetCompassNorth") {
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
                  float currentHeading = 0.0f;
                  bool hasHeading = computeHeadingDegreesFromQuaternion(quatI, quatJ, quatK, quatReal, currentHeading);
                  if (!hasHeading) {
                    Serial.println("Compass calibration failed - rotation vector not ready");
                    return;
                  }
                  
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
          else if (command.action == "regattaSetPort") {
            if (gps.location.isValid()) {
              double lat = gps.location.lat();
              double lon = gps.location.lng();
              
              // Validate coordinates are within valid ranges
              if (!isValidGpsCoordinates(lat, lon)) {
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
          else if (command.action == "regattaSetStarboard") {
            if (gps.location.isValid()) {
              double lat = gps.location.lat();
              double lon = gps.location.lng();
              
              // Validate coordinates are within valid ranges
              if (!isValidGpsCoordinates(lat, lon)) {
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
          else if (command.action == "regattaClearPort") {
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
          else if (command.action == "regattaClearStarboard") {
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
          else if (command.action == "regattaGet") {
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
          else if (command.action == "setRefreshRate") {
            float newRefreshRate = doc["refreshRate"];
            float nextRefreshRate = 0.0f;
            if (validateRefreshRate(newRefreshRate, 0.5f, 2.0f, nextRefreshRate)) {
              refreshRateSeconds = nextRefreshRate;
              preferences.putFloat("refreshRate", refreshRateSeconds);
              refreshRate = clampRefreshRateMs(refreshRateSeconds, 500, 2000);
              Serial.printf("Refresh rate changed to %.1f seconds (%lu ms)\n", refreshRateSeconds, refreshRateMs(refreshRateSeconds));
              
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
          else if (command.action == "setDeviceName") {
            String requestedDeviceName = doc["deviceName"];
            char trimmedName[21];
            size_t trimmedLen = trimDeviceName(requestedDeviceName.c_str(), trimmedName, sizeof(trimmedName));
            if (trimmedLen == 0 || trimmedLen >= sizeof(trimmedName)) {
              Serial.println("Invalid device name - must be 1-20 characters");
            } else if (!isValidDeviceName(trimmedName, trimmedLen, 20)) {
              Serial.println("Invalid device name - only alphanumeric, underscore, hyphen, and space allowed");
            } else {
              String newDeviceName = String(trimmedName);
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
            }
          }
          else if (command.action == "restartWithNewName") {
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
            
            OtaResponse otaResponse;
            bool started = otaHandler.handleStart(doc.as<JsonObjectConst>(), otaBackend, otaState, millis(), otaResponse);
            if (doc.containsKey("size")) {
              Serial.printf("[BLE OTA] Firmware size: %u bytes\n", otaState.size);
              Serial.printf("[BLE OTA] Free heap: %u bytes\n", ESP.getFreeHeap());
              Serial.printf("[BLE OTA] Flash size: %u bytes\n", ESP.getFlashChipSize());
            } else {
              Serial.println("[BLE OTA] Error: Firmware size not provided");
            }

            if (!started && otaResponse.hasMessage) {
              uint8_t errorCode = otaBackend.getError ? otaBackend.getError() : 0;
              if (errorCode != 0) {
                Serial.printf("[BLE OTA] Update.begin() failed: %s (error code: %u)\n",
                              otaBackend.errorString ? otaBackend.errorString() : "", errorCode);
              }
            }

            if (started) {
              Serial.println("[BLE OTA] Ready to receive firmware data");
            }

            DynamicJsonDocument response(128);
            response["type"] = otaResponse.type;
            if (otaResponse.hasMessage) {
              response["message"] = otaResponse.message;
            }
            String responseStr;
            serializeJson(response, responseStr);
            safeBLESend(responseStr, true);
          }
          else if (doc["cmd"] == "STOP_FW_UPDATE") {
            Serial.println("[BLE OTA] Stopping firmware update");
            
            OtaResponse otaResponse;
            otaHandler.handleStop(otaBackend, otaState, otaResponse);
            Serial.println("[BLE OTA] Update aborted");
            DynamicJsonDocument response(128);
            response["type"] = otaResponse.type;
            String responseStr;
            serializeJson(response, responseStr);
            safeBLESend(responseStr, true);
          }
          else if (doc["cmd"] == "GET_OTA_STATUS") {
            // Send OTA status response
            DynamicJsonDocument response(256);
            response["type"] = "ota_status";
            response["active"] = otaState.active;
            response["library"] = "ESP32 Update";

            OtaStatus status;
            otaHandler.handleStatus(otaState, millis(), status);
            if (status.active) {
              response["elapsed_ms"] = status.elapsedMs;
              response["written"] = status.written;
              response["size"] = status.size;
              if (status.hasProgress) {
                response["progress"] = status.progress;
              }
            }
            
            String responseStr;
            serializeJson(response, responseStr);
            safeBLESend(responseStr, true);
          }
          else if (doc["cmd"] == "FW_CHUNK") {
            OtaResponse otaResponse;
            bool ok = otaHandler.handleChunk(doc.as<JsonObjectConst>(), otaBackend, otaState, otaResponse);
            if (!ok) {
              if (otaResponse.hasMessage) {
                Serial.printf("[BLE OTA] Error: %s\n", otaResponse.message);
              }
            } else if (otaResponse.hasWritten && otaResponse.hasProgress) {
              Serial.printf("[BLE OTA] Wrote %u bytes, total: %u/%u (%.1f%%)\n",
                           otaResponse.written, otaState.written, otaState.size, otaResponse.progress);
            }

            DynamicJsonDocument response(128);
            response["type"] = otaResponse.type;
            if (otaResponse.hasMessage) {
              response["message"] = otaResponse.message;
            }
            if (otaResponse.hasIndex) {
              response["index"] = otaResponse.index;
            }
            if (otaResponse.hasWritten) {
              response["written"] = otaResponse.written;
            }
            if (otaResponse.hasProgress) {
              response["progress"] = otaResponse.progress;
            }
            String responseStr;
            serializeJson(response, responseStr);
            safeBLESend(responseStr, true);
          }
          else if (doc["cmd"] == "VERIFY_FW") {
            OtaResponse otaResponse;
            bool ok = otaHandler.handleVerify(otaBackend, otaState, otaResponse);
            if (ok) {
              Serial.println("[BLE OTA] Firmware update completed successfully!");
            } else {
              Serial.printf("[BLE OTA] Update failed: %s\n",
                           otaBackend.errorString ? otaBackend.errorString() : "");
            }

            DynamicJsonDocument response(128);
            response["type"] = otaResponse.type;
            if (otaResponse.hasMessage) {
              response["message"] = otaResponse.message;
            }
            String responseStr;
            serializeJson(response, responseStr);
            safeBLESend(responseStr, true);
          }
          else if (doc["cmd"] == "APPLY_FW") {
            Serial.println("[BLE OTA] Applying firmware update - restarting...");
            
            // Send response before restart
            OtaResponse otaResponse;
            otaHandler.handleApply(otaResponse);
            DynamicJsonDocument response(128);
            response["type"] = otaResponse.type;
            if (otaResponse.hasMessage) {
              response["message"] = otaResponse.message;
            }
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
  static BleRssiState rssiState;
  
  // Only update RSSI every 3 seconds to reduce noise
  if (millis() - rssiState.lastUpdateMs < 3000) {
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
        updateBleRssiState(rssiState, millis(), true, true, true, rssi);
      } else {
        updateBleRssiState(rssiState, millis(), true, true, false, 0);
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
      updateBleRssiState(rssiState, millis(), true, false, false, 0);
    }
  } else {
    updateBleRssiState(rssiState, millis(), false, false, false, 0);
  }

  bleRSSI = rssiState.current;
  bleRSSIFiltered = rssiState.filtered;
}

// Discovery Mode Functions
void handleDiscoveryButton() {
  int reading = digitalRead(DISCOVERY_BUTTON_PIN);

  // Check for state change (for debug logging)
  if (reading != discoveryButtonState.lastReading) {
    Serial.printf("[DISCOVERY] Button state changed: %s (raw value: %d)\n",
                  reading == LOW ? "PRESSED" : "RELEASED", reading);
  }

  bool pressed = handleDiscoveryButtonPress(
    discoveryButtonState,
    reading,
    millis(),
    debounceDelay
  );

  if (pressed) {
    Serial.println("[DISCOVERY] *** BUTTON PRESS DETECTED! ***");
    if (!discoveryModeActive) {
      Serial.println("[DISCOVERY] Starting discovery mode...");
      startDiscoveryMode();
    } else {
      Serial.println("[DISCOVERY] Stopping discovery mode...");
      stopDiscoveryMode();
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
    static unsigned long lastBlink = 0;
    unsigned long nowMs = millis();
    DiscoveryBlinkStatus status = computeDiscoveryBlink(
      discoveryModeStartTime,
      nowMs,
      DISCOVERY_TIMEOUT_MS,
      3000,
      1000,
      lastBlink
    );

    if (status.timedOut) {
      stopDiscoveryMode();
      return;
    }

    if (status.shouldToggle) {
      digitalWrite(DISCOVERY_LED_PIN, !digitalRead(DISCOVERY_LED_PIN));
      lastBlink = status.nextLastBlinkMs;
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

// Current sensor data
SensorData currentData = {0};

// GPS status
bool gpsDataValid = false;

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
static bool otaBegin(uint32_t size);
static bool otaIsRunning();
static void otaAbort();
static size_t otaWrite(const uint8_t* data, size_t length);
static bool otaEnd(bool evenIfRemaining);
static const char* otaErrorString();
static uint8_t otaGetError();

// GPS Functions
bool readGPS();
bool isGPSDataValid();

// Generate random BLE address to help bypass client cache
void generateRandomBLEAddress() {
  uint8_t randomAddr[6];
  
  // Generate random MAC address
  esp_fill_random(randomAddr, 6);
  
  // Ensure it's a valid random address (first two bits should be '11')
  normalizeRandomBleAddress(randomAddr, sizeof(randomAddr));
  
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

static bool otaBegin(uint32_t size) { return Update.begin(size); }
static bool otaIsRunning() { return Update.isRunning(); }
static void otaAbort() { Update.abort(); }
static size_t otaWrite(const uint8_t* data, size_t length) {
  return Update.write(const_cast<uint8_t*>(data), length);
}
static bool otaEnd(bool evenIfRemaining) { return Update.end(evenIfRemaining); }
static const char* otaErrorString() { return Update.errorString(); }
static uint8_t otaGetError() { return Update.getError(); }

OtaBackend otaBackend = {
  otaBegin,
  otaIsRunning,
  otaAbort,
  otaWrite,
  otaEnd,
  otaErrorString,
  otaGetError
};

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
      
      String reduced;
      if (reduceBlePayload(jsonData, MAX_BLE_PACKET_SIZE, reduced)) {
        jsonData = reduced;
        Serial.printf("[BLE] Reduced JSON to %d bytes\n", jsonData.length());
      } else {
        Serial.printf("[BLE] ERROR: Unable to reduce JSON below %d bytes (now %d)\n", MAX_BLE_PACKET_SIZE, jsonData.length());
        return; // Skip sending to avoid fragmentation/corruption
      }
    }
    
    // Validate JSON format
    if (!isBleJsonEnvelopeValid(jsonData.c_str(), jsonData.length())) {
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

#ifdef ARDUINO_USB_CDC_ON_BOOT
  // USB CDC needs host enumeration; wait up to 3s for serial to be ready
  unsigned long serialTimeout = millis() + 3000;
  while (!Serial && millis() < serialTimeout) { delay(100); }
#endif

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
  refreshRate = clampRefreshRateMs(refreshRateSeconds, 500, 2000);
  Serial.printf("[Boot] Refresh rate set to %d ms (%.1f seconds)\n", refreshRate, refreshRateSeconds);
  
  // Initialize I2C for BNO080 with detection
  Wire.begin(BNO080_SDA, BNO080_SCL);
  Wire.setClock(400000); // Set I2C to 400kHz Fast mode (BNO08X supports up to 400kHz)
  Wire.setTimeOut(100); // Prevent I2C peripheral hangs on ESP32-S3 when device NACKs
  
  Serial.print("Testing BNO080 connection... ");
  Serial.printf("I2C SDA=%d, SCL=%d\n", BNO080_SDA, BNO080_SCL);
  
  // Test I2C bus first
  Wire.beginTransmission(0x4A); // BNO080 default I2C address
  uint8_t i2cError = Wire.endTransmission();
  Serial.printf("I2C scan result: %d (0=success, 2=NACK, 4=other error)\n", i2cError);
  
  if (imu.begin()) {
    Serial.println("BNO080 begin() successful, configuring sensor...");
    
    // Enable rotation vector (gyro+accel+mag fusion, tilt-compensated heading).
    // IMPORTANT: Must NOT enable any other sensor reports (accel, gyro, mag)
    // or the rotation vector will stop producing data on this hardware revision.
    // The rotation vector internally uses all three sensors.
    imu.enableRotationVector(100); // 100ms = 10Hz
    Serial.println("Rotation vector configuration sent (10Hz)");
    delay(500); // Give sensor time to process the command
    
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
  bool testResult = windReader.read(testSpeed, testDirection);
  if (testResult) {
    Serial.printf("Wind sensor test PASSED: %.2f m/s (%.1f kt) @ %d°\n", 
                  testSpeed, testSpeed * 1.944, testDirection);
  } else {
    Serial.println("Wind sensor test FAILED - check connections and power");
  }
  
  // Initialize RLCD display with LVGL
  display_lvgl_init();

  Serial.println("Setup complete");
}

void loop() {
  // Handle discovery button and mode
  handleDiscoveryButton();
  updateDiscoveryStatus();
  
  // Handle OTA progress LED blinking using official component
  if (otaState.active) {
    unsigned long currentTime = millis();
    
    // Periodic status reporting (every 5 seconds)
    static unsigned long lastStatusReport = 0;
    if (currentTime - lastStatusReport > 5000) {
      OtaTimeoutStatus status = computeOtaTimeoutStatus(otaState.startTimeMs, currentTime, 50, 60);
      Serial.printf("[BLE OTA] Status: Active for %lu ms (%lu minutes) using official Espressif component\n", 
                   status.elapsedMs, status.elapsedMinutes);
      
      // Warn when approaching timeout (at 50 minutes)
      if (status.shouldWarn) {
        Serial.printf("[BLE OTA] WARNING: Approaching timeout in %lu minutes\n", 60 - status.elapsedMinutes);
      }
      
      lastStatusReport = currentTime;
    }
    
    // Check for total OTA timeout (60 minutes - allow for very large firmware and slow BLE)
    OtaTimeoutStatus status = computeOtaTimeoutStatus(otaState.startTimeMs, currentTime, 50, 60);
    if (status.timedOut) {
      Serial.printf("[BLE OTA] Total timeout after %lu ms (%lu minutes). Component will handle cleanup.\n", 
                   status.elapsedMs, status.elapsedMinutes);
      resetOtaState(otaState);
      
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

  // Handle serial debug commands
  if (Serial.available() > 0) {
    int cmd = Serial.read();
    if (cmd == 'd' || cmd == 'D') {
      Serial.println("[Debug] Display framebuffer dump requested");
      display_serial_dump();
    }
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
    
    // Update RLCD display with sensor data via LVGL
    display_lvgl_update(currentData);
    
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

  float magnitudes[ACCEL_BUFFER_SIZE];
  int count = 0;
  for (int i = 0; i < validPoints; i++) {
    int idx = (accelIndex - validPoints + i + ACCEL_BUFFER_SIZE) % ACCEL_BUFFER_SIZE;
    if (!accelBuffer[idx].valid) continue;
    magnitudes[count++] = accelBuffer[idx].magnitude;
  }

  // Movement detection thresholds
  const float MOVEMENT_STD_DEV_THRESHOLD = 0.5;  // m/s² - acceleration variation indicating movement
  const float MOVEMENT_RANGE_THRESHOLD = 1.0;    // m/s² - total acceleration range indicating movement
  const float MIN_AVERAGE_ACCEL = 8.0;           // m/s² - minimum for valid readings (gravity ~9.81)
  const float MAX_AVERAGE_ACCEL = 12.0;          // m/s² - maximum for valid readings
  
  AccelStats stats;
  bool movementDetected = detectAccelMovement(
    magnitudes,
    count,
    MOVEMENT_STD_DEV_THRESHOLD,
    MOVEMENT_RANGE_THRESHOLD,
    MIN_AVERAGE_ACCEL,
    MAX_AVERAGE_ACCEL,
    &stats
  );

  #ifdef DEBUG_GPS
  static unsigned long lastAccelDebugTime = 0;
  if (millis() - lastAccelDebugTime > 2000) { // Debug every 2 seconds
    Serial.printf("[Accel Movement] Avg: %.2f m/s², StdDev: %.2f, Range: %.2f, Movement: %s\n",
                  stats.avgMagnitude, stats.stdDev, stats.range, movementDetected ? "YES" : "NO");
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
  
  GpsTrackPoint ordered[GPS_TRACK_BUFFER_SIZE];
  for (int i = 0; i < validPoints; i++) {
    int idx = (gpsTrackIndex - validPoints + i + GPS_TRACK_BUFFER_SIZE) % GPS_TRACK_BUFFER_SIZE;
    ordered[i].lat = gpsTrackBuffer[idx].lat;
    ordered[i].lon = gpsTrackBuffer[idx].lon;
    ordered[i].valid = gpsTrackBuffer[idx].valid;
  }

  bool movementDetected = isGpsMovementConsistentTrack(
    ordered,
    validPoints,
    3.0f,
    5.0f,
    45.0f
  );

  lastResult = movementDetected;
  return movementDetected;
}

// Enhanced GPS speed filtering with accelerometer data
float filterGPSSpeed(float rawSpeed, int satellites, float hdop) {
  // Basic GPS quality check - less strict than before
  bool goodGPSQuality = (satellites >= 4 && hdop <= 3.0);
  
  // If GPS quality is very poor, don't trust readings
  if (!goodGPSQuality) {
    return filterGpsSpeed(rawSpeed, false, imuAvailable, false, false, lastValidSpeed);
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
  float recentSpeeds[SPEED_SMOOTH_SIZE];
  bool recentValid[SPEED_SMOOTH_SIZE];
  int recentCount = 0;
  int available = gpsTrackBufferFull ? GPS_TRACK_BUFFER_SIZE : gpsTrackIndex;

  for (int i = 0; i < SPEED_SMOOTH_SIZE && i < available; i++) {
    int idx = (gpsTrackIndex - 1 - i + GPS_TRACK_BUFFER_SIZE) % GPS_TRACK_BUFFER_SIZE;
    recentSpeeds[recentCount] = gpsTrackBuffer[idx].speed;
    recentValid[recentCount] = gpsTrackBuffer[idx].valid;
    recentCount++;
  }

  float smoothedSpeed = smoothGpsSpeed(recentSpeeds, recentValid, recentCount, rawSpeed);
  
  // Enhanced movement detection combining GPS track and accelerometer
  bool gpsMovementDetected = isMovementConsistent();
  bool accelMovementDetected = isAccelerometerMovementDetected();
  
  return filterGpsSpeed(smoothedSpeed,
                        true,
                        imuAvailable,
                        gpsMovementDetected,
                        accelMovementDetected,
                        lastValidSpeed);
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
  if (windReader.read(sensorWindSpeed, sensorWindAngle)) {
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
    const unsigned long IMU_READ_INTERVAL = 50; // Read IMU every 50ms (20Hz to match accel rate)
    
    if (millis() - lastIMURead >= IMU_READ_INTERVAL) {
      lastIMURead = millis();

      // Re-enable sensor features if no data received for a while
      static unsigned long lastRvReEnable = 0;
      static bool rvEverWorked = false;
      static unsigned long lastDataReceived = 0;
      unsigned long now_ = millis();
      // Trigger recovery if: data stopped for 3s, OR no data ever after 10s
      bool needRecovery = (rvEverWorked && lastDataReceived > 0 && now_ - lastDataReceived > 3000)
                       || (!rvEverWorked && lastDataReceived == 0 && now_ - lastRvReEnable > 10000);
      if (needRecovery && now_ - lastRvReEnable > 5000) {
        lastRvReEnable = now_;
        Wire.end();
        Wire.begin(BNO080_SDA, BNO080_SCL);
        Wire.setClock(400000);
        Wire.setTimeOut(100);
        delay(5);
        imu.enableGameRotationVector(100);
      }

      if (imu.dataAvailable()) {
        lastDataReceived = millis();
        // dataAvailable() processes incoming sensor reports from BNO080
        // It updates internal variables: rawAccelX/Y/Z, rawMagX/Y/Z, rawQuatI/J/K/Real
        
        // **USE ACCELEROMETER FOR FAST HEEL/PITCH CALCULATION**
        // The rotation vector (quaternion) updates too slowly (~4-6 seconds)
        // Accelerometer updates fast and reliably every cycle
        
        // Get accelerometer readings (in m/s²) — only valid after enableAccelerometer is called
        float accelX = imu.getAccelX();
        float accelY = imu.getAccelY();
        float accelZ = imu.getAccelZ();
        
        // Calculate heel (roll) from gravity vector
        float rawRoll = 0.0f;
        float rawPitch = 0.0f;
        // Only compute if we have valid accel data (non-zero gravity)
        if (fabsf(accelZ) > 1.0f) {
          computeRollPitchDegrees(accelX, accelY, accelZ, rawRoll, rawPitch);
        }
        
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
        
        // Compass calculation — use rotation vector for tilt-compensated heading
        // BNO080's rotation vector internally fuses gyro + accel + mag
        float quatI = imu.getQuatI();
        float quatJ = imu.getQuatJ();
        float quatK = imu.getQuatK();
        float quatReal = imu.getQuatReal();
        
        float heading = 0.0f;
          if (computeHeadingDegreesFromQuaternion(quatI, quatJ, quatK, quatReal, heading)) {
          rvEverWorked = true;
          
          // After rotation vector converges, enable accelerometer for heel/pitch.
          // IMPORTANT: On this hardware, enabling accel BEFORE rotation vector
          // prevents rotvec from producing data. But enabling it after works.
          static bool accelEnabled = false;
          if (!accelEnabled) {
            delay(50); // Brief pause before sending command
            imu.enableAccelerometer(50);
            accelEnabled = true;
            #ifdef DEBUG_BNO080
            Serial.println("[BNO080] Accelerometer enabled (20Hz) after rotation vector convergence");
            #endif
          }
          
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
          float qMag = sqrtf(quatI*quatI + quatJ*quatJ + quatK*quatK + quatReal*quatReal);
          float radAcc = imu.getQuatRadianAccuracy();
          Serial.printf("[BNO080] Rotation vector not ready (i=%.4f j=%.4f k=%.4f real=%.4f mag=%.4f acc=%.4f)\n",
                        quatI, quatJ, quatK, quatReal, qMag, radAcc);
          #endif
        }
        
        // Read and store accelerometer data
        currentData.accelX = imu.getAccelX();
        currentData.accelY = imu.getAccelY();
        currentData.accelZ = imu.getAccelZ();
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

  // Comprehensive all-sensors debug dump (every 2 seconds)
  static unsigned long lastSensorDump = 0;
  if (millis() - lastSensorDump > 2000) {
    lastSensorDump = millis();

    // --- GPS Diagnostics ---
    int gpsAvail = gpsSerial.available();
    Serial.printf("[DIAG] GPS serial avail=%d charsProcessed=%d failedCS=%d\n",
                  gpsAvail, gps.charsProcessed(), gps.failedChecksum());

    // --- IMU Diagnostics ---
    if (!imuAvailable) {
      Serial.println("[DIAG] IMU: NOT AVAILABLE (begin() failed or I2C no response)");
    } else {
      int reportCount = 0;
      for (int i = 0; i < 10; i++) {
        if (imu.dataAvailable()) {
          reportCount++;
          // Update currentData with values from the last drained report
          currentData.accelX = imu.getAccelX();
          currentData.accelY = imu.getAccelY();
          currentData.accelZ = imu.getAccelZ();
          float qI = imu.getQuatI(), qJ = imu.getQuatJ(), qK = imu.getQuatK(), qR = imu.getQuatReal();
          float hdg = 0.0f;
          if (computeHeadingDegreesFromQuaternion(qI, qJ, qK, qR, hdg)) {
            if (northCalibrated) { hdg -= headingOffset; if (hdg < 0) hdg += 360; if (hdg >= 360) hdg -= 360; }
            currentData.HDM = (int)round(hdg);
          }
          float rawRoll, rawPitch;
          computeRollPitchDegrees(currentData.accelX, currentData.accelY, currentData.accelZ, rawRoll, rawPitch);
          currentData.tilt = rawRoll - rollOffset;
          currentData.pitch = rawPitch - pitchOffset;
        } else break;
      }

      // Probe I2C bus health
      auto i2cProbe = [](int addr) -> int {
        Wire.beginTransmission(addr);
        return Wire.endTransmission();
      };
      int p4B = i2cProbe(0x4B);
      Serial.printf("[DIAG] IMU: I2C probe 0x4B=%d\n", p4B);

      bool hasAccel = (currentData.accelX != 0.0f || currentData.accelY != 0.0f || currentData.accelZ != 0.0f);
      Serial.printf("[DIAG] IMU: drained=%d accel=%s heading=%d\n",
                    reportCount, hasAccel ? "YES" : "NO", currentData.HDM);
    }

    Serial.println("=== SENSOR READINGS ===");
    Serial.printf("GPS: Lat=%.6f Lon=%.6f SOG=%.2fkt COG=%.1f Sats=%d HDOP=%.1f\n",
                  gps.location.lat(), gps.location.lng(),
                  currentData.speed, gps.course.deg(),
                  gps.satellites.value(), gps.hdop.hdop());
    Serial.printf("Wind (Apparent): %.1fkt @ %d\n", currentData.windSpeed, currentData.windAngle);
    Serial.printf("Wind (True): %.1fkt @ %d\n", currentData.trueWindSpeed, currentData.trueWindAngle);
    Serial.printf("IMU: Heel=%.1f Pitch=%.1f Heading=%d\n", currentData.tilt, currentData.pitch, currentData.HDM);
    Serial.printf("Accel: X=%.2f Y=%.2f Z=%.2f m/s²\n", currentData.accelX, currentData.accelY, currentData.accelZ);
    Serial.println("=======================");
  }
}

// Generate JSON string with current sensor data using marine standard terminology
String getSensorDataJson() {
  BleGpsSnapshot gpsSnapshot = {
    gps.location.isValid(),
    gps.location.lat(),
    gps.location.lng(),
    gps.course.isValid(),
    gps.course.deg(),
    static_cast<int>(gps.charsProcessed()),
    gps.satellites.isValid(),
    static_cast<int>(gps.satellites.value()),
    gps.hdop.isValid(),
    static_cast<float>(gps.hdop.hdop())
  };

  BleRegattaSnapshot regattaSnapshot = {
    regattaData.hasStartLine,
    regattaData.distanceToLine
  };

  return buildSensorDataJson(currentData, gpsSnapshot, imuAvailable, bleRSSIFiltered, regattaSnapshot);
}

// GPS Functions

// Check if GPS has valid, recent data
bool isGPSDataValid() {
  GpsValidityInput input = {
    static_cast<int>(gps.charsProcessed()),
    static_cast<int>(gps.sentencesWithFix()),
    gps.location.isValid(),
    gps.location.age(),
    gps.satellites.isValid(),
    static_cast<int>(gps.satellites.value())
  };

  return isGpsDataValid(input);
}

// Read GPS data
bool readGPS() {
  GpsReadResult readResult = readGpsStream(gpsSerial, gps, 256);

  // Return true only if we have valid, recent location data
  return readResult.newData && isGPSDataValid();
}

// Regatta Functions

// Calculate current distance to regatta start line
void calculateRegattaData() {
  RegattaLine line;
  line.hasStartLine = regattaData.hasStartLine;
  line.portLat = regattaData.portLat;
  line.portLon = regattaData.portLon;
  line.starboardLat = regattaData.starboardLat;
  line.starboardLon = regattaData.starboardLon;

  GpsFix fix;
  fix.valid = gps.location.isValid();
  fix.lat = gps.location.lat();
  fix.lon = gps.location.lng();

  regattaData.distanceToLine = calculateRegattaDistance(line, fix);
}
