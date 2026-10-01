#pragma once
#include <ArduinoJson.h>
#include "sensor_data.h"
#include "imu_service.h"
#ifdef ARDUINO
#include <WString.h>
#else
#include "ble_string.h"
#endif

// Two independent, bounded notifications, never mixed with navigation telemetry.
inline String vaneDiagnosticPacket(unsigned long request, int part, unsigned long now,
    const SensorData& data, const ImuService& service, bool available,
    bool north, float offset, bool gpsValid, unsigned int satellites) {
  StaticJsonDocument<512> doc;
  doc["type"] = "vane_diag";
  doc["id"] = request;
  doc["part"] = part;
  if (part == 0) {
    doc["up"] = now;
    doc["imu"] = available;
    doc["q"] = service.quaternionReports;
    doc["a"] = service.accelReports;
    if (service.quaternionReports) doc["age"] = now - service.lastQuaternionMs;
    else doc["age"] = -1;
    doc["quality"] = data.headingQuality;
  } else {
    doc["north"] = north;
    doc["offset"] = roundf(offset * 10) / 10;
    doc["raw"] = service.quaternionReports ? roundf(data.headingRaw * 10) / 10 : NAN;
    doc["hdg"] = data.HDM;
    doc["rej"] = data.headingRejected;
    doc["gps"] = gpsValid;
    doc["sat"] = satellites;
  }
  char output[181];
  if (measureJson(doc) > 180) return String();
  serializeJson(doc, output, sizeof(output));
  return String(output);
}
