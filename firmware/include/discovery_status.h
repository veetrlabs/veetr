#pragma once

struct DiscoveryBlinkStatus {
  bool timedOut = false;
  bool shouldToggle = false;
  unsigned long nextLastBlinkMs = 0;
};

inline DiscoveryBlinkStatus computeDiscoveryBlink(unsigned long startMs,
                                                  unsigned long nowMs,
                                                  unsigned long timeoutMs,
                                                  unsigned long blinkDelayMs,
                                                  unsigned long blinkIntervalMs,
                                                  unsigned long lastBlinkMs) {
  DiscoveryBlinkStatus status;
  if (nowMs < startMs) {
    status.nextLastBlinkMs = lastBlinkMs;
    return status;
  }

  unsigned long elapsed = nowMs - startMs;
  if (elapsed > timeoutMs) {
    status.timedOut = true;
    status.nextLastBlinkMs = lastBlinkMs;
    return status;
  }

  if (elapsed > blinkDelayMs) {
    if (nowMs - lastBlinkMs > blinkIntervalMs) {
      status.shouldToggle = true;
      status.nextLastBlinkMs = nowMs;
      return status;
    }
  }

  status.nextLastBlinkMs = lastBlinkMs;
  return status;
}
