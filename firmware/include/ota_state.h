#pragma once

#include <stdint.h>

struct OtaState {
  bool active = false;
  uint32_t size = 0;
  uint32_t written = 0;
  unsigned long startTimeMs = 0;
};

inline void resetOtaState(OtaState& state) {
  state.active = false;
  state.size = 0;
  state.written = 0;
  state.startTimeMs = 0;
}
