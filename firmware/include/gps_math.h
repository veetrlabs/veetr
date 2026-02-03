#pragma once

#include <math.h>

constexpr float kGpsPi = 3.14159265358979323846f;

inline float calculateDistanceMeters(double lat1, double lon1, double lat2, double lon2) {
  const float earthRadius = 6371000.0f;
  float dLat = static_cast<float>((lat2 - lat1) * kGpsPi / 180.0);
  float dLon = static_cast<float>((lon2 - lon1) * kGpsPi / 180.0);
  float lat1Rad = static_cast<float>(lat1 * kGpsPi / 180.0);
  float lat2Rad = static_cast<float>(lat2 * kGpsPi / 180.0);
  float sinLat = sinf(dLat / 2.0f);
  float sinLon = sinf(dLon / 2.0f);
  float a = sinLat * sinLat + cosf(lat1Rad) * cosf(lat2Rad) * sinLon * sinLon;
  float c = 2.0f * atan2f(sqrtf(a), sqrtf(1.0f - a));
  return earthRadius * c;
}

inline float calculateBearingDegrees(double lat1, double lon1, double lat2, double lon2) {
  float lat1Rad = static_cast<float>(lat1 * kGpsPi / 180.0);
  float lat2Rad = static_cast<float>(lat2 * kGpsPi / 180.0);
  float dLon = static_cast<float>((lon2 - lon1) * kGpsPi / 180.0);
  float y = sinf(dLon) * cosf(lat2Rad);
  float x = cosf(lat1Rad) * sinf(lat2Rad) -
      sinf(lat1Rad) * cosf(lat2Rad) * cosf(dLon);
  float bearing = atan2f(y, x) * 180.0f / kGpsPi;
  float normalized = fmodf(bearing + 360.0f, 360.0f);
  return normalized;
}
