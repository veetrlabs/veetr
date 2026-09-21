#pragma once

#include <stdint.h>
#include "sensor_data.h"
#include "imu_math.h"

// Consume reports independently of GPS/Modbus/telemetry timing. A quaternion
// report must not count as a fresh accelerometer sample (or vice versa).
class ImuService {
 public:
  unsigned long lastQuaternionMs = 0;
  unsigned long lastAccelMs = 0;
  unsigned long maxPollMs = 0;
  uint32_t quaternionReports = 0;
  uint32_t accelReports = 0;

  template <typename Imu, typename Clock>
  void poll(Imu& imu, SensorData& data, Clock now, float rollOffset,
            float pitchOffset, float headingOffset, bool northCalibrated,
            void (*storeAccel)(float, float, float)) {
    const unsigned long start = now();
    if (started_ && start - lastPollMs_ < 10) return;
    started_ = true;
    lastPollMs_ = start;
    for (int i = 0; i < 8 && now() - start < 5; ++i) {
      const uint16_t report = imu.getReadings();
      if (report == 0) break;
      if (report == 0x05) { // SH-2 magnetic rotation vector
        float heading;
        if (computeHeadingDegreesFromQuaternion(imu.getQuatI(), imu.getQuatJ(),
              imu.getQuatK(), imu.getQuatReal(), heading)) {
          lastQuaternionMs = now();
          ++quaternionReports;
          if (northCalibrated) heading -= headingOffset;
          heading = fmodf(heading + 360.0f, 360.0f);
          data.HDM = static_cast<int>(roundf(heading)) % 360;
          if (!accelEnabled_) {
            imu.enableAccelerometer(50);
            accelEnabled_ = true;
          }
        }
      } else if (report == 0x01) { // SH-2 accelerometer, including gravity
        data.accelX = imu.getAccelX();
        data.accelY = imu.getAccelY();
        data.accelZ = imu.getAccelZ();
        float roll, pitch;
        computeRollPitchDegrees(data.accelX, data.accelY, data.accelZ, roll, pitch);
        data.tilt = roll - rollOffset;
        data.pitch = pitch - pitchOffset;
        lastAccelMs = now();
        ++accelReports;
        storeAccel(data.accelX, data.accelY, data.accelZ);
      }
    }
    const unsigned long end = now();
    if (end - start > maxPollMs) maxPollMs = end - start;
    // Watch each stream independently: accel traffic must not conceal a stalled compass.
    if (end - lastRecoveryMs_ >= 5000 &&
        (quaternionReports == 0 || end - lastQuaternionMs > 3000)) {
      imu.enableRotationVector(100);
      lastRecoveryMs_ = end;
    }
    if (quaternionReports == 0 || end - lastQuaternionMs > 3000) data.HDM = -1;
    if (accelReports == 0 || end - lastAccelMs > 3000) {
      data.tilt = NAN;
      data.pitch = NAN;
      data.accelX = data.accelY = data.accelZ = NAN;
      if (accelEnabled_ && end - lastAccelRecoveryMs_ >= 5000) {
        imu.enableAccelerometer(50);
        lastAccelRecoveryMs_ = end;
      }
    }
  }
 private:
  bool started_ = false;
  bool accelEnabled_ = false;
  unsigned long lastPollMs_ = 0;
  unsigned long lastRecoveryMs_ = 0;
  unsigned long lastAccelRecoveryMs_ = 0;
};
