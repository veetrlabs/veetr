#pragma once

#include <math.h>

#include <ArduinoJson.h>

#include "sensor_data.h"

#ifdef ARDUINO
#include <WString.h>
#else
#include "ble_string.h"
#endif

struct BleGpsSnapshot {
  bool locationValid;
  double lat;
  double lon;
  bool courseValid;
  double courseDeg;
  int charsProcessed;
  bool satellitesValid;
  int satellitesValue;
  bool hdopValid;
  float hdop;
};

struct BleRegattaSnapshot {
  bool hasStartLine;
  float distanceToLine;
};

inline bool bleIsNan(float value) {
  return isnan(value);
}


inline String buildSensorDataJson(const SensorData& data,
                                 const BleGpsSnapshot& gps,
                                 bool imuAvailable,
                                 int bleRSSIFiltered,
                                 const BleRegattaSnapshot& regatta) {
  DynamicJsonDocument doc(1024);

  doc["SOG"] = round((bleIsNan(data.speed) ? 0.0f : data.speed) * 10) / 10.0f;

  if (gps.locationValid) {
    doc["lat"] = round(gps.lat * 100000) / 100000.0;
    doc["lon"] = round(gps.lon * 100000) / 100000.0;
  } else {
    doc["lat"] = 0.0;
    doc["lon"] = 0.0;
  }

  if (gps.courseValid) {
    doc["COG"] = round(gps.courseDeg);
  } else {
    doc["COG"] = 0;
  }

  doc["sat"] = (gps.charsProcessed > 10 && gps.satellitesValid) ? gps.satellitesValue : 0;

  if (gps.hdopValid) {
    doc["hdop"] = round(gps.hdop * 10) / 10.0f;
  } else {
    doc["hdop"] = 99.9f;
  }

  if (!bleIsNan(data.windSpeed)) {
    doc["AWS"] = round(data.windSpeed * 10) / 10.0f;
  }

  if (data.windAngle >= 0 && data.windAngle <= 359) {
    doc["AWA"] = round(data.windAngle);
  }

  if (!bleIsNan(data.trueWindSpeed)) {
    doc["TWS"] = round(data.trueWindSpeed * 10) / 10.0f;
  }

  if (data.trueWindAngle >= 0 && data.trueWindAngle <= 359) {
    doc["TWA"] = round(data.trueWindAngle);
  }

  if (imuAvailable && !bleIsNan(data.tilt)) {
    doc["hl"] = round(data.tilt);
  }

  if (imuAvailable && !bleIsNan(data.pitch)) {
    doc["pitch"] = round(data.pitch * 10) / 10.0f;
  }

  if (imuAvailable && data.HDM >= 0 && data.HDM <= 359) {
    doc["HDM"] = round(data.HDM);
  }

  if (imuAvailable && !bleIsNan(data.accelX)) {
    doc["accelX"] = round(data.accelX * 100) / 100.0f;
    doc["accelY"] = round(data.accelY * 100) / 100.0f;
    doc["accelZ"] = round(data.accelZ * 100) / 100.0f;
  }

  doc["rssi"] = bleRSSIFiltered;

  if (regatta.hasStartLine && !bleIsNan(regatta.distanceToLine)) {
    doc["ln"] = round(regatta.distanceToLine);
  }

  size_t needed = measureJson(doc) + 1;
  String output;
  if (needed <= 1024) {
    char buffer[1024] = {0};
    serializeJson(doc, buffer, sizeof(buffer));
    output = buffer;
    return output;
  }

  char* buffer = new char[needed];
  buffer[0] = '\0';
  serializeJson(doc, buffer, needed);
  output = buffer;
  delete[] buffer;
  return output;
}
