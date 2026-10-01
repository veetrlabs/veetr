#pragma once
#include <stddef.h>
#include <stdio.h>
#include <math.h>
#include "sensor_data.h"

inline bool hasDisplayHeading(int heading) {
  return heading >= 0 && heading < 360;
}

inline void formatDisplayHeading(int heading, char* text, size_t size) {
  if (hasDisplayHeading(heading)) snprintf(text, size, "HDG %03d", heading);
  else snprintf(text, size, "HDG ---");
}

inline bool hasFreshDisplayHeading(const SensorData& data) {
  return hasDisplayHeading(data.HDM) || (isfinite(data.headingRaw) && data.headingRaw >= 0 && data.headingRaw < 360);
}
inline float displayHeading(const SensorData& data) {
  return hasDisplayHeading(data.HDM) ? data.HDM : data.headingRaw;
}
inline void formatDisplayHeading(const SensorData& data, char* text, size_t size) {
  if (hasDisplayHeading(data.HDM)) formatDisplayHeading(data.HDM, text, size);
  else if (hasFreshDisplayHeading(data)) snprintf(text, size, "HDG ~%03d", (int)roundf(data.headingRaw) % 360);
  else snprintf(text, size, "HDG ---");
}
