#pragma once
#include "imu_math.h"

// One persisted value represents both a valid reference and its offset.
// A failed write must not change the active reference.
template <typename Imu, typename Service, typename Preferences>
const char* alignCompassNorth(bool available, unsigned long now, Imu& imu,
                             const Service& service, Preferences& preferences,
                             float& offset, bool& calibrated) {
  if (!available) return "sensor_unavailable";
  if (!service.quaternionReports || now - service.lastQuaternionMs >= 1000)
    return "stale_reading";
  if (!service.canAlignNorth(now)) return "quality_not_ready";
  float heading;
  if (!computeHeadingDegreesFromQuaternion(imu.getQuatI(), imu.getQuatJ(),
        imu.getQuatK(), imu.getQuatReal(), heading)) return "invalid_reading";
  if (preferences.putFloat("northOffsetV2", heading) != sizeof(float)) return "storage_failed";
  offset = heading;
  calibrated = true;
  return "accepted";
}
