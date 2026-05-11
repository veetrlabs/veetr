#pragma once

#include <math.h>

constexpr float kPi = 3.14159265358979323846f;

inline void computeRollPitchDegrees(float accelX, float accelY, float accelZ,
                                    float& rollDeg, float& pitchDeg) {
  float roll = atan2f(accelX, sqrtf(accelY * accelY + accelZ * accelZ));
  float pitch = atan2f(accelY, sqrtf(accelX * accelX + accelZ * accelZ));
  rollDeg = roll * 180.0f / kPi;
  pitchDeg = pitch * 180.0f / kPi;
}

inline bool computeHeadingDegreesFromQuaternion(float quatI, float quatJ, float quatK,
                                                float quatReal, float& headingDeg) {
  float quatMag = sqrtf(quatI * quatI + quatJ * quatJ + quatK * quatK + quatReal * quatReal);
  if (quatMag <= 0.1f) {
    return false;
  }

  float heading = atan2f(2.0f * (quatI * quatJ + quatReal * quatK),
                         quatReal * quatReal + quatI * quatI - quatJ * quatJ - quatK * quatK);
  heading = heading * 180.0f / kPi;
  if (heading < 0) {
    heading += 360.0f;
  }
  headingDeg = heading;
  return true;
}
