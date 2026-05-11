#pragma once

inline bool validateRefreshRate(float value, float minSeconds, float maxSeconds, float& outSeconds) {
  if (value < minSeconds || value > maxSeconds) {
    return false;
  }
  outSeconds = value;
  return true;
}

inline unsigned long refreshRateMs(float seconds) {
  return static_cast<unsigned long>(seconds * 1000.0f);
}
