#include <unity.h>

#include <stdio.h>

#include "ble_payload.h"
#include "ble_json.h"

void test_live_heading_diagnostics_do_not_block_sensor_packet() {
  SensorData data = {};
  data.speed = 0.1f;
  data.windSpeed = 12.3f;
  data.windAngle = 245;
  data.trueWindSpeed = 12.2f;
  data.trueWindAngle = 246;
  data.HDM = 192;
  data.headingRaw = 192.12345f;
  data.headingAccuracyRad = 0.12345f;
  data.headingQuality = 3;
  data.headingRejected = 1234;
  BleGpsSnapshot gps = {true, 43.75094, 15.63054, true, 284, 1000, true, 12, true, 0.9f};
  BleRegattaSnapshot line = {true, 10252};
  String output;
  TEST_ASSERT_TRUE(reduceBlePayload(buildSensorDataJson(data, gps, true, -76, line), 180, output));
  TEST_ASSERT_TRUE(output.length() <= 180);
  StaticJsonDocument<1024> doc;
  TEST_ASSERT_FALSE(deserializeJson(doc, output.c_str()));
  TEST_ASSERT_EQUAL(192, doc["HDM"].as<int>());
  TEST_ASSERT_TRUE(doc.containsKey("AWS"));
  TEST_ASSERT_TRUE(doc.containsKey("SOG"));
  TEST_ASSERT_TRUE(doc.containsKey("lat"));
  TEST_ASSERT_EQUAL(3, doc["hQ"].as<int>());
  TEST_ASSERT_FLOAT_WITHIN(.1, 192.1, doc["hR"].as<float>());
  data.HDM = -1; data.headingQuality = 1;
  TEST_ASSERT_TRUE(reduceBlePayload(buildSensorDataJson(data, gps, true, -76, line), 180, output));
  doc.clear(); deserializeJson(doc, output.c_str());
  TEST_ASSERT_FALSE(doc.containsKey("HDM"));
  TEST_ASSERT_EQUAL(1, doc["hQ"].as<int>());
  TEST_ASSERT_FLOAT_WITHIN(.1, 192.1, doc["hR"].as<float>());
}

static void makePayload(const char* deviceName, char* output, size_t outputCap) {
  const char* prefix = "{\"SOG\":1.2,\"lat\":1.0,\"lon\":2.0,\"COG\":45,\"sat\":6,\"hdop\":0.9,"
                       "\"AWS\":4.2,\"AWA\":120,\"TWS\":5.1,\"TWA\":118,\"hl\":3,\"pitch\":1.1,"
                       "\"HDM\":200,\"accelX\":0.12,\"accelY\":0.13,\"accelZ\":0.14,\"rssi\":-60,"
                       "\"deviceName\":\"";
  const char* suffix = "\"}";
  size_t needed = strlen(prefix) + strlen(deviceName) + strlen(suffix) + 1;
  TEST_ASSERT_TRUE(needed <= outputCap);
  snprintf(output, outputCap, "%s%s%s", prefix, deviceName, suffix);
}

void setUp() {}
void tearDown() {}

void test_payload_under_limit_unchanged() {
  String input = "{\"SOG\":1.2}";
  String output;

  bool ok = reduceBlePayload(input, 180, output);

  TEST_ASSERT_TRUE(ok);
  TEST_ASSERT_EQUAL_STRING(input.c_str(), output.c_str());
}

void test_payload_exact_limit_unchanged() {
  char inputBuf[256] = {0};
  makePayload("short", inputBuf, sizeof(inputBuf));
  String input = inputBuf;
  String output;

  bool ok = reduceBlePayload(input, input.length(), output);

  TEST_ASSERT_TRUE(ok);
  TEST_ASSERT_EQUAL_STRING(input.c_str(), output.c_str());
}

void test_payload_just_over_limit_reduces() {
  char inputBuf[256] = {0};
  makePayload("short", inputBuf, sizeof(inputBuf));
  String input = inputBuf;
  String output;

  bool ok = reduceBlePayload(input, input.length() - 1, output);

  TEST_ASSERT_TRUE(ok);
  TEST_ASSERT_TRUE(strcmp(input.c_str(), output.c_str()) != 0);
}

void test_payload_reduces_by_removing_accel_pitch() {
  char inputBuf[512] = {0};
  makePayload("short", inputBuf, sizeof(inputBuf));
  String input = inputBuf;
  String output;

  bool ok = reduceBlePayload(input, 140, output);

  TEST_ASSERT_TRUE(ok);
  TEST_ASSERT_TRUE(strcmp(input.c_str(), output.c_str()) != 0);
  TEST_ASSERT_TRUE(strstr(output.c_str(), "accelX") == nullptr);
  TEST_ASSERT_TRUE(strstr(output.c_str(), "accelY") == nullptr);
  TEST_ASSERT_TRUE(strstr(output.c_str(), "accelZ") == nullptr);
  TEST_ASSERT_TRUE(strstr(output.c_str(), "pitch") == nullptr);
}

void test_payload_reduces_second_stage_fields() {
  char inputBuf[512] = {0};
  makePayload("this-is-a-very-long-device-name-to-force-reduction", inputBuf, sizeof(inputBuf));
  String input = inputBuf;
  String output;

  bool ok = reduceBlePayload(input, 120, output);

  TEST_ASSERT_TRUE(ok);
  TEST_ASSERT_TRUE(strstr(output.c_str(), "deviceName") == nullptr);
  TEST_ASSERT_TRUE(strstr(output.c_str(), "rssi") == nullptr);
  TEST_ASSERT_TRUE(strstr(output.c_str(), "hdop") == nullptr);
}

void test_payload_unreducible_returns_false() {
  char inputBuf[512] = {0};
  makePayload("this-is-a-very-long-device-name-to-force-reduction", inputBuf, sizeof(inputBuf));
  String input = inputBuf;
  String output;

  bool ok = reduceBlePayload(input, 40, output);

  TEST_ASSERT_FALSE(ok);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_live_heading_diagnostics_do_not_block_sensor_packet);
  RUN_TEST(test_payload_under_limit_unchanged);
  RUN_TEST(test_payload_exact_limit_unchanged);
  RUN_TEST(test_payload_just_over_limit_reduces);
  RUN_TEST(test_payload_reduces_by_removing_accel_pitch);
  RUN_TEST(test_payload_reduces_second_stage_fields);
  RUN_TEST(test_payload_unreducible_returns_false);
  return UNITY_END();
}
