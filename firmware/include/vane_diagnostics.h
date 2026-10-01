#pragma once
#include <ArduinoJson.h>
#include "sensor_data.h"
#include "imu_service.h"
#include "imu_diagnostics.h"
#ifdef ARDUINO
#include <WString.h>
#else
#include "ble_string.h"
#endif

// Two independent, bounded notifications, never mixed with navigation telemetry.
inline String vaneDiagnosticPacket(unsigned long request, int part, unsigned long now,
    const SensorData& data, const ImuService& service, bool available,
    bool north, float offset, bool gpsValid, unsigned int satellites, const ImuDiagnostics* extra=nullptr) {
  StaticJsonDocument<512> doc;
  doc["type"] = "vane_diag";
  doc["id"] = request;
  doc["part"] = part;
  if (part == 0) {
    if(extra)doc["n"]=4;
    doc["up"] = now;
    doc["imu"] = available;
    doc["q"] = service.quaternionReports;
    doc["a"] = service.accelReports;
    if (service.quaternionReports) doc["age"] = now - service.lastQuaternionMs;
    else doc["age"] = -1;
    doc["quality"] = data.headingQuality;
  } else if(part==1) {
    doc["north"] = north;
    doc["offset"] = roundf(offset * 10) / 10;
    doc["raw"] = service.quaternionReports ? roundf(data.headingRaw * 10) / 10 : NAN;
    doc["hdg"] = data.HDM;
    doc["rej"] = data.headingRejected;
    doc["gps"] = gpsValid;
    doc["sat"] = satellites;
  } else if(extra) {
    auto scaled=[](float value,float scale)->float {return isfinite(value)?roundf(value*scale):NAN;};
    auto age=[now](unsigned long stamp)->long {if(!stamp)return -1; unsigned long delta=now-stamp; return static_cast<long>(delta>2147483647UL ? 2147483647UL : delta);};
    if(part==2){
      doc["mx"]=extra->magAt?scaled(extra->mx,10):NAN;doc["my"]=extra->magAt?scaled(extra->my,10):NAN;doc["mz"]=extra->magAt?scaled(extra->mz,10):NAN;
      doc["mq"]=extra->mq;doc["ma"]=age(extra->magAt);
      doc["ce"]=extra->cal;doc["ca"]=age(extra->calAt);
      doc["acc"]=service.quaternionReports?scaled(data.headingAccuracyRad,1000):NAN;
    }else if(part==3){
      doc["gx"]=extra->gyroAt?scaled(extra->gx,1000):NAN;doc["gy"]=extra->gyroAt?scaled(extra->gy,1000):NAN;doc["gz"]=extra->gyroAt?scaled(extra->gz,1000):NAN;
      doc["bx"]=extra->gyroAt?scaled(extra->bx,1000):NAN;doc["by"]=extra->gyroAt?scaled(extra->by,1000):NAN;doc["bz"]=extra->gyroAt?scaled(extra->bz,1000):NAN;
      doc["gq"]=extra->gq;doc["ga"]=age(extra->gyroAt);
    }
  }
  char output[181];
  if (measureJson(doc) > 180) return String();
  serializeJson(doc, output, sizeof(output));
  return String(output);
}
