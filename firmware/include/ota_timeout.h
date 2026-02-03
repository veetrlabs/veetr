#pragma once

#include <stdint.h>

struct OtaTimeoutStatus {
  unsigned long elapsedMs = 0;
  unsigned long elapsedMinutes = 0;
  bool shouldWarn = false;
  bool timedOut = false;
};

inline OtaTimeoutStatus computeOtaTimeoutStatus(unsigned long startMs,
                                                unsigned long nowMs,
                                                unsigned long warnMinutes,
                                                unsigned long timeoutMinutes) {
  OtaTimeoutStatus status;
  if (nowMs < startMs) {
    return status;
  }

  status.elapsedMs = nowMs - startMs;
  status.elapsedMinutes = status.elapsedMs / 60000UL;
  status.shouldWarn = status.elapsedMinutes >= warnMinutes;
  status.timedOut = status.elapsedMinutes >= timeoutMinutes;
  return status;
}
