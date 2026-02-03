#pragma once

#include <math.h>

struct AccelStats {
  float avgMagnitude = 0.0f;
  float stdDev = 0.0f;
  float range = 0.0f;
  bool hasData = false;
};

inline AccelStats computeAccelStats(const float* magnitudes, int count) {
  AccelStats stats;
  if (!magnitudes || count <= 0) {
    return stats;
  }

  float total = 0.0f;
  float maxMag = -1.0f;
  float minMag = 1e9f;
  for (int i = 0; i < count; i++) {
    float mag = magnitudes[i];
    total += mag;
    if (mag > maxMag) maxMag = mag;
    if (mag < minMag) minMag = mag;
  }

  float avg = total / static_cast<float>(count);
  float variance = 0.0f;
  for (int i = 0; i < count; i++) {
    float diff = magnitudes[i] - avg;
    variance += diff * diff;
  }
  variance /= static_cast<float>(count);

  stats.avgMagnitude = avg;
  stats.stdDev = sqrtf(variance);
  stats.range = maxMag - minMag;
  stats.hasData = true;
  return stats;
}

inline bool detectAccelMovement(const float* magnitudes, int count,
                                float stdDevThreshold, float rangeThreshold,
                                float minAvg, float maxAvg, AccelStats* outStats) {
  if (count < 3) {
    if (outStats) {
      *outStats = AccelStats();
    }
    return false;
  }

  AccelStats stats = computeAccelStats(magnitudes, count);
  if (outStats) {
    *outStats = stats;
  }

  if (!stats.hasData) {
    return false;
  }

  bool validAccelData = (stats.avgMagnitude >= minAvg && stats.avgMagnitude <= maxAvg);
  bool movementDetected = validAccelData &&
      (stats.stdDev > stdDevThreshold || stats.range > rangeThreshold);
  return movementDetected;
}
