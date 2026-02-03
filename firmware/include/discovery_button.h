#pragma once

#include <stdint.h>

struct DiscoveryButtonState {
  int lastReading = 1;
  unsigned long lastDebounceMs = 0;
  bool processed = false;
};

inline bool handleDiscoveryButtonPress(DiscoveryButtonState& state,
                                       int reading,
                                       unsigned long nowMs,
                                       unsigned long debounceMs) {
  if (reading != state.lastReading) {
    state.lastDebounceMs = nowMs;
    state.lastReading = reading;
  }

  if (nowMs - state.lastDebounceMs > debounceMs) {
    if (reading == 0 && !state.processed) {
      state.processed = true;
      return true;
    }
    if (reading != 0) {
      state.processed = false;
    }
  }

  return false;
}
