#pragma once

#include <stdbool.h>

struct BleRssiState {
  unsigned long lastUpdateMs = 0;
  int readings[5] = {0};
  int index = 0;
  bool initialized = false;
  int current = 0;
  int filtered = 0;
};

inline void updateBleRssiState(BleRssiState& state,
                              unsigned long nowMs,
                              bool deviceConnected,
                              bool hasConnIds,
                              bool rssiReadOk,
                              int rssiValue) {
  if (nowMs - state.lastUpdateMs < 3000) {
    return;
  }

  if (!deviceConnected || !hasConnIds) {
    state.current = 0;
    state.filtered = 0;
    state.lastUpdateMs = nowMs;
    return;
  }

  if (!rssiReadOk) {
    state.current = -50;
    state.filtered = -50;
    state.lastUpdateMs = nowMs;
    return;
  }

  state.current = rssiValue;

  if (!state.initialized) {
    for (int i = 0; i < 5; i++) {
      state.readings[i] = rssiValue;
    }
    state.initialized = true;
  }

  state.readings[state.index] = rssiValue;
  state.index = (state.index + 1) % 5;

  int sum = 0;
  for (int i = 0; i < 5; i++) {
    sum += state.readings[i];
  }
  state.filtered = sum / 5;

  state.lastUpdateMs = nowMs;
}
