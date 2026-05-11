#include <unity.h>

#include "ble_json.h"

static BleGpsSnapshot makeGps(bool valid) {
  BleGpsSnapshot gps = {};
  gps.locationValid = valid;
  gps.lat = 37.0;
  gps.lon = -122.0;
  gps.courseValid = valid;
  gps.courseDeg = 123.4;
  gps.charsProcessed = 20;
  gps.satellitesValid = true;
  gps.satellitesValue = 7;
  gps.hdopValid = true;
  gps.hdop = 0.9f;
  return gps;
}

static SensorData makeData() {
  SensorData data = {};
  data.speed = 5.2f;
  data.windSpeed = 4.4f;
  data.windAngle = 90;
  data.trueWindSpeed = 6.1f;
  data.trueWindAngle = 120;
  data.tilt = 3.0f;
  data.pitch = 1.2f;
  data.HDM = 200;
  data.accelX = 0.1f;
  data.accelY = 0.2f;
  data.accelZ = 0.3f;
  return data;
}

static bool hasKey(const String& json, const char* key) {
  return strstr(json.c_str(), key) != nullptr;
}

void setUp() {}
void tearDown() {}

void test_json_includes_wind_when_valid() {
  SensorData data = makeData();
  BleGpsSnapshot gps = makeGps(true);
  BleRegattaSnapshot regatta = {false, NAN};

  String json = buildSensorDataJson(data, gps, true, -60, regatta);

  TEST_ASSERT_TRUE(hasKey(json, "AWS"));
  TEST_ASSERT_TRUE(hasKey(json, "AWA"));
  TEST_ASSERT_TRUE(hasKey(json, "TWS"));
  TEST_ASSERT_TRUE(hasKey(json, "TWA"));
}

void test_json_excludes_wind_when_invalid() {
  SensorData data = makeData();
  data.windSpeed = NAN;
  data.windAngle = -1;
  data.trueWindSpeed = NAN;
  data.trueWindAngle = -1;
  BleGpsSnapshot gps = makeGps(true);
  BleRegattaSnapshot regatta = {false, NAN};

  String json = buildSensorDataJson(data, gps, true, -60, regatta);

  TEST_ASSERT_FALSE(hasKey(json, "AWS"));
  TEST_ASSERT_FALSE(hasKey(json, "AWA"));
  TEST_ASSERT_FALSE(hasKey(json, "TWS"));
  TEST_ASSERT_FALSE(hasKey(json, "TWA"));
}

void test_json_excludes_imu_when_unavailable() {
  SensorData data = makeData();
  BleGpsSnapshot gps = makeGps(true);
  BleRegattaSnapshot regatta = {false, NAN};

  String json = buildSensorDataJson(data, gps, false, -60, regatta);

  TEST_ASSERT_FALSE(hasKey(json, "hl"));
  TEST_ASSERT_FALSE(hasKey(json, "pitch"));
  TEST_ASSERT_FALSE(hasKey(json, "HDM"));
  TEST_ASSERT_FALSE(hasKey(json, "accelX"));
}

void test_json_gps_invalid_defaults() {
  SensorData data = makeData();
  BleGpsSnapshot gps = makeGps(false);
  gps.charsProcessed = 0;
  gps.satellitesValid = false;
  gps.hdopValid = false;
  BleRegattaSnapshot regatta = {false, NAN};

  String json = buildSensorDataJson(data, gps, true, -60, regatta);

  TEST_ASSERT_TRUE(hasKey(json, "\"lat\":0"));
  TEST_ASSERT_TRUE(hasKey(json, "\"lon\":0"));
  TEST_ASSERT_TRUE(hasKey(json, "\"COG\":0"));
  TEST_ASSERT_TRUE(hasKey(json, "\"sat\":0"));
  TEST_ASSERT_TRUE(hasKey(json, "\"hdop\":99.9"));
}

void test_json_includes_regatta_line_when_valid() {
  SensorData data = makeData();
  BleGpsSnapshot gps = makeGps(true);
  BleRegattaSnapshot regatta = {true, 12.3f};

  String json = buildSensorDataJson(data, gps, true, -60, regatta);

  TEST_ASSERT_TRUE(regatta.hasStartLine);
  TEST_ASSERT_FALSE(isnan(regatta.distanceToLine));
  TEST_ASSERT_TRUE(strstr(json.c_str(), "\"ln\"") != nullptr);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_json_includes_wind_when_valid);
  RUN_TEST(test_json_excludes_wind_when_invalid);
  RUN_TEST(test_json_excludes_imu_when_unavailable);
  RUN_TEST(test_json_gps_invalid_defaults);
  RUN_TEST(test_json_includes_regatta_line_when_valid);
  return UNITY_END();
}
