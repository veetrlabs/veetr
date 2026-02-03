#pragma once

#include <stdint.h>

inline void normalizeRandomBleAddress(uint8_t* address, size_t length) {
  if (!address || length < 6) {
    return;
  }
  address[5] |= 0xC0;
}
