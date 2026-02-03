#include <unity.h>

#include "gps_speed_filter.h"

void setUp() {}
void tearDown() {}

void test_poor_quality_decays_without_updating_last() {
  float lastValid = 2.0f;
  float out = filterGpsSpeed(1.0f, false, false, false, false, lastValid);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 1.9f, out);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 2.0f, lastValid);
}

void test_stationary_below_threshold_returns_zero() {
  float lastValid = 1.0f;
  float out = filterGpsSpeed(0.05f, true, false, false, false, lastValid);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.0f, out);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.0f, lastValid);
}

void test_movement_below_threshold_keeps_speed() {
  float lastValid = 0.0f;
  float out = filterGpsSpeed(0.04f, true, true, true, true, lastValid);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.04f, out);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.04f, lastValid);
}

void test_hysteresis_requires_extra_when_stationary() {
  float lastValid = 0.0f;
  float out = filterGpsSpeed(0.1f, true, false, true, false, lastValid);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.0f, out);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.0f, lastValid);

  out = filterGpsSpeed(0.2f, true, false, true, false, lastValid);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.2f, out);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.2f, lastValid);
}

void test_moving_updates_last_valid() {
  float lastValid = 1.5f;
  float out = filterGpsSpeed(2.0f, true, false, true, false, lastValid);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 2.0f, out);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 2.0f, lastValid);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_poor_quality_decays_without_updating_last);
  RUN_TEST(test_stationary_below_threshold_returns_zero);
  RUN_TEST(test_movement_below_threshold_keeps_speed);
  RUN_TEST(test_hysteresis_requires_extra_when_stationary);
  RUN_TEST(test_moving_updates_last_valid);
  return UNITY_END();
}

