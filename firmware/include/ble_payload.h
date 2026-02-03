#pragma once

#include <string.h>

#include <ArduinoJson.h>

#ifdef ARDUINO
#include <WString.h>
#else
#include "ble_string.h"
#endif

inline bool reduceBlePayload(const String& input, size_t maxLen, String& output) {
  if (input.length() <= maxLen) {
    output = input;
    return true;
  }

  StaticJsonDocument<1024> tmpDoc;
  DeserializationError dErr = deserializeJson(tmpDoc, input.c_str());
  if (dErr) {
    return false;
  }

  tmpDoc.remove("accelX");
  tmpDoc.remove("accelY");
  tmpDoc.remove("accelZ");
  tmpDoc.remove("pitch");

  char buffer[1024] = {0};
  serializeJson(tmpDoc, buffer, sizeof(buffer));
  output = buffer;

  if (output.length() > maxLen) {
    tmpDoc.remove("deviceName");
    tmpDoc.remove("rssi");
    tmpDoc.remove("hdop");
    memset(buffer, 0, sizeof(buffer));
    serializeJson(tmpDoc, buffer, sizeof(buffer));
    output = buffer;
  }

  return output.length() <= maxLen;
}
