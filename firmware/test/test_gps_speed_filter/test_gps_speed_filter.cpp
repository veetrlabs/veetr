#include <unity.h>
#include "gps_speed_filter.h"
void setUp() {}
void tearDown() {}
void test_bad_fix_never_repeats_previous_speed() {
  float last = 2;
  TEST_ASSERT_TRUE(isnan(filterGpsSpeed(1, false, false, false, false, last)));
  TEST_ASSERT_EQUAL_FLOAT(0, last);
  TEST_ASSERT_TRUE(isnan(filterGpsSpeed(1, false, false, false, false, last)));
}
void test_stationary_noise() {
  float last = 2;
  TEST_ASSERT_EQUAL_FLOAT(0, filterGpsSpeed(0.1, true, false, false, false, last));
  TEST_ASSERT_EQUAL_FLOAT(0, filterGpsSpeed(0.5, true, true, false, false, last, true));
  TEST_ASSERT_EQUAL_FLOAT(0, filterGpsSpeed(1, false, true, false, false, last, true));
}
void test_constant_velocity_and_slow_displacement() {
  float last = 0;
  TEST_ASSERT_EQUAL_FLOAT(4, filterGpsSpeed(4, true, true, false, false, last, true));
  TEST_ASSERT_EQUAL_FLOAT(0.1, filterGpsSpeed(0.1, true, true, true, false, last, true));
}
void test_missing_accel_is_not_stationary() {
  float last = 0;
  TEST_ASSERT_EQUAL_FLOAT(0.5, filterGpsSpeed(0.5, true, true, false, false, last));
  TEST_ASSERT_EQUAL_FLOAT(0.5, filterGpsSpeed(0.5, true, true, false, true, last, true));
}
void test_invalid_speed_and_recovery() {
  float last = 0;
  TEST_ASSERT_TRUE(isnan(filterGpsSpeed(NAN, true, true, true, true, last)));
  TEST_ASSERT_TRUE(isnan(filterGpsSpeed(-1, true, true, true, true, last)));
  TEST_ASSERT_EQUAL_FLOAT(2, filterGpsSpeed(2, true, true, true, true, last));
}
int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_bad_fix_never_repeats_previous_speed);
  RUN_TEST(test_stationary_noise);
  RUN_TEST(test_constant_velocity_and_slow_displacement);
  RUN_TEST(test_missing_accel_is_not_stationary);
  RUN_TEST(test_invalid_speed_and_recovery);
  return UNITY_END();
}
