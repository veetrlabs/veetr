# Stationary SOG and BNO080 latency investigation

## Findings (2026-09-21)

The source code confirms software bottlenecks. A hardware fault has not been
confirmed or excluded: no USB-connected board was available for this investigation.
Do not select a replacement IMU based on the previous firmware's refresh rate.

In the previous firmware, `readSensors()` ran only when the telemetry timer expired
(default 1 second), and set the next deadline **after** all sensor work completed.
Inside that function, the nominal 20/50 ms IMU interval could not make acquisition
faster than its caller. Each `dataAvailable()` consumed one report, while the
firmware requested rotation vectors at 10 Hz and acceleration at 20 Hz. The RLCD
build drained up to ten more reports only in a diagnostic block every two seconds.
Those consumers could fall behind the requested stream rate and show old data.

The installed ModbusMaster library has a 2000 ms response timeout. The old idle
callback only yielded to the OS; it did not run application sensor code. The
conditional `setResponseTimeout` call was not active for this library. A missing
wind sensor therefore made IMU polling even slower. This is an additional problem;
the one-second acquisition gate exists even with a working wind sensor.

The old IMU reader also treated any report as fresh data for both acceleration and
heading. Accelerometer traffic could mask a stopped rotation-vector stream. Its
startup workaround claimed that running both reports stopped the chip, but the
application was not consuming the combined stream at its requested rate, so that
claim was not enough evidence of a chip limitation.

The [checked-in BNO080/085 datasheet](../firmware/include/BNO080_085-Datasheet_v1.16.md)
(section 6.8) lists typical rotation-vector latency of 6.6 ms at 100 Hz. That is a
vendor reference figure, not a measurement of this board or its 10 Hz configuration.

## Changes

- Both boards service GPS and the IMU from the main loop and the Modbus idle
  callback, independently of the slow sensor/telemetry interval. Display and BLE
  servicing also remain active during Modbus waits. Bus work stays on one task.
- The shared IMU reader drains up to eight reports per poll, with a 5 ms budget
  between calls. This is not a hard timeout on an individual library call.
- Only rotation-vector reports refresh heading and only accelerometer reports
  populate the motion window. Each stream has its own freshness/recovery checks.
  Calibration callbacks use fresh cached readings instead of competing for I2C.
- Acceleration is enabled after the first valid magnetic rotation vector, without
  the old per-reading delay. Diagnostic code no longer consumes separate reports.
- GPS SOG uses a small noise floor (~0.29 knots), recent acceleration, and net GPS
  displacement beyond position uncertainty. Quiet acceleration can suppress only
  small speeds; it does not veto normal steady movement. Very slow real movement
  below the noise floor needs enough displacement to distinguish it from drift.
- The firmware no longer returns `lastValidSpeed * 0.95` without updating that state,
  which previously repeated a non-zero speed indefinitely under poor GPS quality.
  Unknown speed is sent as `SOG: null` and shown as `--` on the RLCD, separately from
  a stationary zero. Unavailable/stale accelerometer data is not evidence of rest.
- The mobile live view and phone recording both apply speed filtering. Foreground
  acceleration uses a 5 Hz, three-second window. Background recording uses GPS
  evidence when acceleration is unavailable; it never reuses stale foreground motion.

The thresholds are conservative heuristics, not an inertial navigation solution.
Poor GPS at significant speed remains unknown rather than being labelled stationary.
Phone position accuracy (the screenshot's ±4 m) is not a guarantee of speed accuracy.

## Hardware verification still needed

1. Build the relevant target with `-DDEBUG_SENSOR_TIMING` added to its PlatformIO
   `build_flags`, then flash it and open the serial monitor at 115200 baud.
2. Rotate/tilt the board, first with the wind sensor connected, then disconnected.
   Every five seconds, `[IMU timing]` reports cumulative quaternion/acceleration
   counts, ages since the latest reports, and maximum duration of a poll.
3. After startup, expect roughly 50 quaternion and 100 acceleration reports per
   five seconds for the configured rates. Confirm fresh ages and responsive
   heading/heel during both tests. Counts depend on actual sensor configuration
   and report batching; they are diagnostic expectations, not measured results.
4. If polling repeatedly takes ~100 ms or more or reports still disappear, inspect
   I2C transactions, power, pull-ups, wiring and the BNO080 interrupt connection.
   This SparkFun driver's `waitForI2C()` can itself wait 100 ms; the reader's budget
   cannot interrupt it. An interrupt-assisted reader or driver/interface change
   should be evaluated before replacing the sensor.
5. Test SOG on a stationary table indoors, outdoors, walking, and at slow steady
   boat speeds. Include stopping, motion restarting, sensor loss and app backgrounding.
   Tune thresholds from recordings if very slow sailing is suppressed too long.

## Validation

Native tests cover stationary GPS noise, poor-fix state, missing motion evidence,
slow displacement, resumed movement, unknown-speed serialization, bounded report
consumption, independent stream freshness, and servicing a simulated two-second
Modbus wait. The simulation validates software scheduling, not physical I2C latency.
Both `esp32dev` and `esp32s3-rlcd` are compiled. Mobile tests cover speed filtering,
motion sample validity/freshness, subscription cleanup, and normal recording flows.

The phone accelerometer uses `expo-sensors` for
[Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/accelerometer/).
A new native mobile build is required. Neither firmware flashing nor app deployment
was performed as part of these source changes.
