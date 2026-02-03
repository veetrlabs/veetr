#pragma once

inline float filterGpsSpeed(float smoothedSpeed,
                            bool goodGpsQuality,
                            bool imuAvailable,
                            bool gpsMovementDetected,
                            bool accelMovementDetected,
                            float& lastValidSpeed) {
  if (!goodGpsQuality) {
    return lastValidSpeed * 0.95f;
  }

  bool realMovementDetected = false;
  if (imuAvailable) {
    realMovementDetected = gpsMovementDetected || accelMovementDetected;
  } else {
    realMovementDetected = gpsMovementDetected;
  }

  float noiseThreshold = 0.08f;
  if (imuAvailable && accelMovementDetected && gpsMovementDetected) {
    noiseThreshold = 0.05f;
  } else if (imuAvailable && !accelMovementDetected && !gpsMovementDetected) {
    noiseThreshold = 0.12f;
  }

  if (smoothedSpeed < noiseThreshold) {
    if (realMovementDetected) {
      lastValidSpeed = smoothedSpeed;
      return smoothedSpeed;
    }
    lastValidSpeed = 0.0f;
    return 0.0f;
  }

  const float HYSTERESIS_FACTOR = 0.1f;
  if (lastValidSpeed < noiseThreshold) {
    if (smoothedSpeed > (noiseThreshold + HYSTERESIS_FACTOR)) {
      lastValidSpeed = smoothedSpeed;
      return smoothedSpeed;
    }
    return 0.0f;
  }

  lastValidSpeed = smoothedSpeed;
  return smoothedSpeed;
}
