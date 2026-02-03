#include <unity.h>

#include <stdio.h>

#include "ble_payload.h"

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
  RUN_TEST(test_payload_under_limit_unchanged);
  RUN_TEST(test_payload_exact_limit_unchanged);
  RUN_TEST(test_payload_just_over_limit_reduces);
  RUN_TEST(test_payload_reduces_by_removing_accel_pitch);
  RUN_TEST(test_payload_reduces_second_stage_fields);
  RUN_TEST(test_payload_unreducible_returns_false);
  return UNITY_END();
}
