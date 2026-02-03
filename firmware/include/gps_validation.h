#pragma once

#ifdef ARDUINO
#include <Arduino.h>
#endif

struct GpsValidityInput {
  int charsProcessed;
  int sentencesWithFix;
  bool locationValid;
  unsigned long locationAgeMs;
  bool satellitesValid;
  int satellitesValue;
};

inline bool isGpsDataValid(const GpsValidityInput& input) {
  return input.charsProcessed > 10 &&
         input.sentencesWithFix > 0 &&
         input.locationValid &&
         input.locationAgeMs < 5000 &&
         input.satellitesValid &&
         input.satellitesValue >= 3;
}

inline bool isValidGpsCoordinates(double lat, double lon) {
  if (lat == 0.0 && lon == 0.0) {
    return false;
  }

  if (lat < -90.0 || lat > 90.0) {
#ifdef ARDUINO
    Serial.printf("[GPS Validation] Invalid latitude: %.6f (must be -90 to +90)\n", lat);
#endif
    return false;
  }

  if (lon < -180.0 || lon > 180.0) {
#ifdef ARDUINO
    Serial.printf("[GPS Validation] Invalid longitude: %.6f (must be -180 to +180)\n", lon);
#endif
    return false;
  }

  return true;
}
