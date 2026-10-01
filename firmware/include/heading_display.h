#pragma once
#include <stddef.h>
#include <stdio.h>

inline bool hasDisplayHeading(int heading) {
  return heading >= 0 && heading < 360;
}

inline void formatDisplayHeading(int heading, char* text, size_t size) {
  if (hasDisplayHeading(heading)) snprintf(text, size, "HDG %03d", heading);
  else snprintf(text, size, "HDG ---");
}
