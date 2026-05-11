#pragma once

struct SensorData {
  float speed;          // Vessel speed in knots
  float windSpeed;      // Apparent wind speed in knots
  int windAngle;        // Apparent wind angle in degrees (0-360)
  float trueWindSpeed;  // True wind speed in knots
  int trueWindAngle;    // True wind angle in degrees (0-360)
  float tilt;           // Vessel heel/tilt angle in degrees (roll)
  float pitch;          // Vessel pitch/trim angle in degrees
  int HDM;              // Magnetic heading in degrees (0-359)
  float accelX;         // Acceleration X-axis in m/s²
  float accelY;         // Acceleration Y-axis in m/s²
  float accelZ;         // Acceleration Z-axis in m/s²
};
