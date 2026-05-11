#pragma once

#include <math.h>

#ifndef PI
#define PI 3.14159265f
#endif

inline void calculateTrueWind(float vesselSpeed,
                              int apparentWindAngle,
                              float apparentWindSpeed,
                              float& trueWindSpeed,
                              int& trueWindAngle) {
  // Convert apparent wind angle to radians (0-360° input)
  float appWindAngleRad = apparentWindAngle * PI / 180.0f;

  // Convert apparent wind to velocity components (relative to vessel)
  // Apparent wind angle is measured clockwise from bow (0°=ahead, 90°=starboard, 180°=behind, 270°=port)
  float appWindX = apparentWindSpeed * sin(appWindAngleRad);  // Cross-track component (positive = starboard)
  float appWindY = apparentWindSpeed * cos(appWindAngleRad);  // Along-track component (positive = ahead)

  // True wind components = apparent wind - vessel velocity
  // Vessel is moving forward (positive Y direction)
  float trueWindX = appWindX;  // Cross-track component unchanged
  float trueWindY = appWindY - vesselSpeed;  // Subtract vessel forward speed

  // Calculate true wind speed
  trueWindSpeed = sqrt(trueWindX * trueWindX + trueWindY * trueWindY);

  // Calculate true wind angle (relative to vessel bow, 0-360°)
  float trueWindAngleRad = atan2(trueWindX, trueWindY);
  trueWindAngle = round(trueWindAngleRad * 180.0f / PI);

  // Normalize angle to 0-359° range
  if (trueWindAngle < 0) trueWindAngle += 360;
  if (trueWindAngle >= 360) trueWindAngle -= 360;

  // Ensure we don't have negative wind speeds
  if (trueWindSpeed < 0) {
    trueWindSpeed = 0;
  }
}
