# Firmware Testing (CI Plan)

This document describes the planned automated testing strategy for the ESP32 firmware. The goal is to run fast, deterministic unit tests in CI by simulating the ESP32 and sensors on a host machine, while still supporting hardware validation locally.

> Note: As of now, CI tests are not yet implemented. This doc is the blueprint we will follow when adding them.

## Goals
- Catch regressions in firmware logic before hardware testing.
- Keep CI tests fast and deterministic (no real hardware required).
- Separate pure logic from hardware-specific integrations.

## How CI Testing Works (Planned)
We will use PlatformIO's Test Runner (Unity framework) with a host-native test environment that compiles and runs the firmware logic on the CI runner:

- **Host-native tests**: Compile core firmware logic for the host ("native") with mocks for ESP32 APIs and sensors.
- **No hardware in CI**: BLE, Wi-Fi, I2C/SPI, GPIO, and timing-sensitive code will be mocked or excluded.
- **Deterministic execution**: No delays, real timers, or background tasks in CI tests.

Planned CI flow:
1. Install PlatformIO and dependencies.
2. Build and run `pio test -e native`.
3. Report pass/fail and artifacts (test output logs).

## Running Tests Locally (Planned)
Once implemented, you will be able to run tests from the repo root:

```bash
# Run host-native unit tests
pio test -e native

# (Optional) Run tests on real ESP32 hardware
pio test -e esp32dev
```

Notes:
- The **native** environment will be added to `platformio.ini` and will compile test targets with mocks.
- The **esp32dev** environment will support limited integration tests on real hardware.

## Writing a New Test
PlatformIO tests live under `firmware/test/`.

Recommended structure:
```
firmware/test/
  test_<module_name>/
    test_<module_name>.cpp
```

Example skeleton (Unity):
```cpp
#include <unity.h>

void test_example(void) {
  TEST_ASSERT_EQUAL_INT(2, 1 + 1);
}

void setup() {
  UNITY_BEGIN();
  RUN_TEST(test_example);
  UNITY_END();
}

void loop() {
  // Not used in unit tests
}
```

Guidelines:
- Prefer **pure functions** and **small units**.
- Use **mocks/fakes** for hardware interfaces (BLE, I2C, SPI, GPIO, timers).
- Avoid `delay()` and time-based logic in tests; use controllable fake time.
- Keep tests deterministic and fast.

## What Can Be Tested in CI
Good candidates for CI tests:
- Parsing and encoding (NMEA, JSON, binary payloads)
- Sensor data fusion logic (math/filters) using simulated inputs
- State machines and event handling logic
- Calibration transforms and unit conversions
- Command handling and configuration logic
- Error handling and retry logic

## What Cannot Be Reliably Tested in CI
Not suitable for host-native CI:
- Real BLE stack behavior and connections
- Wi-Fi, networking, OTA, or ESP-IDF-specific APIs
- I2C/SPI bus behavior, GPIO timing, interrupts
- Real sensor behavior (BNO080, GPS, Modbus) without hardware
- Power usage, RF performance, or real-time scheduling

These require **hardware-in-loop** or manual testing on an ESP32 device.

## Testing Boundaries
We will explicitly separate:
- **Core logic** (testable in CI)
- **Hardware adapters** (mocked in CI, validated on device)

When adding new features, prefer adding tests at the core logic layer so they can run in CI.

## Related Docs
- PlatformIO setup and commands: `docs/PLATFORMIO.md`
- Development workflow: `docs/DEVELOPMENT.md`
