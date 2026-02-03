#pragma once

#ifdef ARDUINO
#include <WString.h>
#else
#include "ble_string.h"
#endif

#ifndef BLE_SEND_MAX_WAIT_MS
#define BLE_SEND_MAX_WAIT_MS 100
#endif

inline bool safeBleSendCore(void* serverPtr,
                            int connectedCount,
                            void* characteristicPtr,
                            bool& sendingFlag,
                            const String& data,
                            bool isCommand,
                            unsigned long (*millisFn)(),
                            void (*delayFn)(unsigned long),
                            bool (*setValueFn)(void* characteristic, const uint8_t* value, size_t len),
                            void (*notifyFn)(void* characteristic)) {
  if (!serverPtr || connectedCount == 0 || !characteristicPtr) {
    return false;
  }

  unsigned long startTime = millisFn();
  while (sendingFlag && (millisFn() - startTime) < BLE_SEND_MAX_WAIT_MS) {
    delayFn(1);
  }

  if (sendingFlag) {
    return false;
  }

  sendingFlag = true;
  bool ok = false;

  const uint8_t* bytes = reinterpret_cast<const uint8_t*>(data.c_str());
  if (setValueFn(characteristicPtr, bytes, data.length())) {
    notifyFn(characteristicPtr);
    delayFn(isCommand ? 10 : 5);
    ok = true;
  }

  sendingFlag = false;
  return ok;
}
