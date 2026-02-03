#pragma once

#include <stdlib.h>

#include "base64.h"

#ifdef ARDUINO
#include <WString.h>
#else
#include "ble_string.h"
#endif

struct OtaChunk {
  uint8_t* data = nullptr;
  int length = 0;
};

inline void freeOtaChunk(OtaChunk& chunk) {
  if (chunk.data) {
    free(chunk.data);
  }
  chunk.data = nullptr;
  chunk.length = 0;
}

inline bool decodeOtaChunk(const String& dataB64, OtaChunk& chunk) {
  chunk.data = nullptr;
  chunk.length = 0;

  if (dataB64.length() == 0) {
    return false;
  }

  int expectedLen = (dataB64.length() * 3) / 4;
  if (expectedLen <= 0) {
    return false;
  }

  uint8_t* decoded = static_cast<uint8_t*>(malloc(expectedLen));
  if (!decoded) {
    return false;
  }

  int actualLen = base64Decode(dataB64.c_str(), decoded, expectedLen);
  if (actualLen <= 0) {
    free(decoded);
    return false;
  }

  chunk.data = decoded;
  chunk.length = actualLen;
  return true;
}
