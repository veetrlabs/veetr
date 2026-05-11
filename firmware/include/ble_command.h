#pragma once

#include <ArduinoJson.h>

#ifdef ARDUINO
#include <WString.h>
#else
#include "ble_string.h"
#endif

struct BleCommand {
  String action;
  String cmd;
  bool hasIndex = false;
  int index = 0;
};

inline bool parseBleCommand(JsonObjectConst obj, BleCommand& out) {
  if (obj.isNull()) {
    return false;
  }

  const char* action = obj["action"];
  const char* cmd = obj["cmd"];
  out.action = action ? action : "";
  out.cmd = cmd ? cmd : "";

  if (obj.containsKey("index")) {
    out.hasIndex = true;
    out.index = obj["index"].as<int>();
  } else {
    out.hasIndex = false;
    out.index = 0;
  }

  if (out.action.length() == 0 && out.cmd.length() == 0 && !out.hasIndex) {
    return false;
  }

  return true;
}

inline bool parseBleCommandDoc(const JsonDocument& doc, BleCommand& out) {
  if (doc.is<JsonArray>()) {
    return false;
  }
  JsonObjectConst obj = doc.as<JsonObjectConst>();
  if (obj.isNull()) {
    return false;
  }
  return parseBleCommand(obj, out);
}
