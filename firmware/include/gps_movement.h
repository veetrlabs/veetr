#pragma once

#include <math.h>

#include "gps_math.h"

struct GpsTrackPoint {
  double lat = 0.0;
  double lon = 0.0;
  bool valid = false;
};

inline bool isGpsMovementConsistentTrack(const GpsTrackPoint* points, int count,
                                         float minAvgDistance, float strongAvgDistance,
                                         float maxAvgBearingChange) {
  if (!points || count < 3) {
    return false;
  }

  float totalDistance = 0.0f;
  float totalBearingChange = 0.0f;
  float lastBearing = 0.0f;
  bool firstBearing = true;
  int consecutivePoints = 0;

  for (int i = 1; i < count; i++) {
    if (!points[i - 1].valid || !points[i].valid) {
      continue;
    }

    float distance = calculateDistanceMeters(points[i - 1].lat, points[i - 1].lon,
                                              points[i].lat, points[i].lon);
    totalDistance += distance;
    consecutivePoints++;

    if (distance > 2.0f) {
      float bearing = calculateBearingDegrees(points[i - 1].lat, points[i - 1].lon,
                                              points[i].lat, points[i].lon);
      if (!firstBearing) {
        float bearingDiff = fabsf(bearing - lastBearing);
        if (bearingDiff > 180.0f) {
          bearingDiff = 360.0f - bearingDiff;
        }
        totalBearingChange += bearingDiff;
      }
      lastBearing = bearing;
      firstBearing = false;
    }
  }

  if (consecutivePoints < 2) {
    return false;
  }

  float avgDistance = totalDistance / static_cast<float>(consecutivePoints);
  if (avgDistance < minAvgDistance) {
    return false;
  }

  if (avgDistance > strongAvgDistance) {
    float avgBearingChange = totalBearingChange / static_cast<float>(consecutivePoints - 1);
    if (avgBearingChange < maxAvgBearingChange) {
      return true;
    }
  }

  return false;
}
