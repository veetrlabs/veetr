#include <unity.h>

#include "gps_validation.h"

void setUp() {}
void tearDown() {}

void test_gps_valid_happy_path() {
  GpsValidityInput input = {20, 1, true, 1000, true, 5};
  TEST_ASSERT_TRUE(isGpsDataValid(input));
}

void test_gps_invalid_due_to_few_chars() {
  GpsValidityInput input = {5, 1, true, 1000, true, 5};
  TEST_ASSERT_FALSE(isGpsDataValid(input));
}

void test_gps_invalid_due_to_no_fix() {
  GpsValidityInput input = {20, 0, true, 1000, true, 5};
  TEST_ASSERT_FALSE(isGpsDataValid(input));
}

void test_gps_invalid_due_to_old_data() {
  GpsValidityInput input = {20, 1, true, 5001, true, 5};
  TEST_ASSERT_FALSE(isGpsDataValid(input));
}

void test_gps_invalid_due_to_satellite_count() {
  GpsValidityInput input = {20, 1, true, 1000, true, 2};
  TEST_ASSERT_FALSE(isGpsDataValid(input));
}

void test_gps_coords_zero_zero_invalid() {
  TEST_ASSERT_FALSE(isValidGpsCoordinates(0.0, 0.0));
}

void test_gps_coords_lat_bounds() {
  TEST_ASSERT_FALSE(isValidGpsCoordinates(-90.1, 10.0));
  TEST_ASSERT_FALSE(isValidGpsCoordinates(90.1, 10.0));
  TEST_ASSERT_TRUE(isValidGpsCoordinates(-90.0, 10.0));
  TEST_ASSERT_TRUE(isValidGpsCoordinates(90.0, 10.0));
}

void test_gps_coords_lon_bounds() {
  TEST_ASSERT_FALSE(isValidGpsCoordinates(10.0, -180.1));
  TEST_ASSERT_FALSE(isValidGpsCoordinates(10.0, 180.1));
  TEST_ASSERT_TRUE(isValidGpsCoordinates(10.0, -180.0));
  TEST_ASSERT_TRUE(isValidGpsCoordinates(10.0, 180.0));
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_gps_valid_happy_path);
  RUN_TEST(test_gps_invalid_due_to_few_chars);
  RUN_TEST(test_gps_invalid_due_to_no_fix);
  RUN_TEST(test_gps_invalid_due_to_old_data);
  RUN_TEST(test_gps_invalid_due_to_satellite_count);
  RUN_TEST(test_gps_coords_zero_zero_invalid);
  RUN_TEST(test_gps_coords_lat_bounds);
  RUN_TEST(test_gps_coords_lon_bounds);
  return UNITY_END();
}

