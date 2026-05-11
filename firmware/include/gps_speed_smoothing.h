#pragma once

inline float smoothGpsSpeed(const float* speeds, const bool* valid, int count, float fallbackSpeed) {
  if (!speeds || count <= 0) {
    return fallbackSpeed;
  }

  float sum = 0.0f;
  int validCount = 0;
  for (int i = 0; i < count; i++) {
    if (!valid || valid[i]) {
      sum += speeds[i];
      validCount++;
    }
  }

  if (validCount == 0) {
    return fallbackSpeed;
  }

  return sum / static_cast<float>(validCount);
}
