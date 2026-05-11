#include <unity.h>

#include "gps_speed_smoothing.h"

void setUp() {}
void tearDown() {}

void test_smooth_gps_speed_averages_valid() {
  float speeds[] = {1.0f, 2.0f, 3.0f};
  bool valid[] = {true, true, true};

  float smoothed = smoothGpsSpeed(speeds, valid, 3, 0.0f);

  TEST_ASSERT_FLOAT_WITHIN(0.001f, 2.0f, smoothed);
}

void test_smooth_gps_speed_ignores_invalid() {
  float speeds[] = {1.0f, 10.0f, 3.0f};
  bool valid[] = {true, false, true};

  float smoothed = smoothGpsSpeed(speeds, valid, 3, 0.0f);

  TEST_ASSERT_FLOAT_WITHIN(0.001f, 2.0f, smoothed);
}

void test_smooth_gps_speed_fallback_when_no_valid() {
  float speeds[] = {1.0f, 10.0f};
  bool valid[] = {false, false};

  float smoothed = smoothGpsSpeed(speeds, valid, 2, 4.5f);

  TEST_ASSERT_FLOAT_WITHIN(0.001f, 4.5f, smoothed);
}

void test_smooth_gps_speed_null_valids() {
  float speeds[] = {2.0f, 4.0f};

  float smoothed = smoothGpsSpeed(speeds, nullptr, 2, 0.0f);

  TEST_ASSERT_FLOAT_WITHIN(0.001f, 3.0f, smoothed);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_smooth_gps_speed_averages_valid);
  RUN_TEST(test_smooth_gps_speed_ignores_invalid);
  RUN_TEST(test_smooth_gps_speed_fallback_when_no_valid);
  RUN_TEST(test_smooth_gps_speed_null_valids);
  return UNITY_END();
}
