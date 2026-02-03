#pragma once

inline int clampRefreshRateMs(float seconds, int minMs, int maxMs) {
  int ms = static_cast<int>(seconds * 1000.0f);
  if (ms < minMs) return minMs;
  if (ms > maxMs) return maxMs;
  return ms;
}
