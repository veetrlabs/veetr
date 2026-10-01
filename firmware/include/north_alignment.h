#pragma once
#include "imu_math.h"

// V2 and legacy storage contain counter-clockwise sensor yaw. Keep that
// on-disk convention for existing references and firmware rollback, while
// all runtime offsets and headings use clockwise compass bearings.
inline float northYawToCompass(float value) {
  return fmodf(360.0f - value, 360.0f);
}

template <typename Preferences>
bool loadCompassNorth(Preferences& preferences, float& offset) {
  const bool v2 = preferences.isKey("northOffsetV2");
  if (!v2 && !preferences.getBool("northCal", false)) return false;
  const float yaw = preferences.getFloat(v2 ? "northOffsetV2" : "headingOffset", 0.0f);
  if (!isfinite(yaw) || yaw < 0 || yaw >= 360) return false;
  offset = northYawToCompass(yaw);
  return true;
}

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
  if (preferences.putFloat("northOffsetV2", northYawToCompass(heading)) != sizeof(float)) return "storage_failed";
  offset = heading;
  calibrated = true;
  return "accepted";
}
