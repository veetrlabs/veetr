#pragma once
#include <math.h>

// Speeds are knots. A quiet accelerometer alone is not proof of zero velocity.
inline float filterGpsSpeed(float speed, bool goodGpsQuality,
                            bool imuAvailable, bool gpsMovementDetected,
                            bool accelMovementDetected, float& lastValidSpeed,
                            bool recentQuietAccel = false) {
  if (!isfinite(speed) || speed < 0) {
    lastValidSpeed = 0;
    return NAN;
  }
  const bool quiet = imuAvailable && recentQuietAccel && !accelMovementDetected;
  const bool noise = !gpsMovementDetected &&
    (speed < 0.29f || (quiet && speed < (goodGpsQuality ? 0.58f : 1.17f)));
  if (noise) {
    lastValidSpeed = 0;
    return 0;
  }
  // Never retain a previous speed indefinitely when the fix quality degrades.
  if (!goodGpsQuality) {
    lastValidSpeed = 0;
    return NAN;
  }
  lastValidSpeed = speed;
  return speed;
}
