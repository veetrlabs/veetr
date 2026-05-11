#include <unity.h>

#include "gps_math.h"

void setUp() {}
void tearDown() {}

void test_distance_equator_one_degree() {
  float distance = calculateDistanceMeters(0.0, 0.0, 0.0, 1.0);

  TEST_ASSERT_FLOAT_WITHIN(500.0f, 111195.0f, distance);
}

void test_distance_symmetric() {
  float forward = calculateDistanceMeters(10.0, -20.0, -5.0, 42.0);
  float reverse = calculateDistanceMeters(-5.0, 42.0, 10.0, -20.0);

  TEST_ASSERT_FLOAT_WITHIN(0.1f, forward, reverse);
}

void test_bearing_east_on_equator() {
  float bearing = calculateBearingDegrees(0.0, 0.0, 0.0, 1.0);

  TEST_ASSERT_FLOAT_WITHIN(0.1f, 90.0f, bearing);
}

void test_bearing_north() {
  float bearing = calculateBearingDegrees(0.0, 0.0, 1.0, 0.0);

  TEST_ASSERT_FLOAT_WITHIN(0.1f, 0.0f, bearing);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_distance_equator_one_degree);
  RUN_TEST(test_distance_symmetric);
  RUN_TEST(test_bearing_east_on_equator);
  RUN_TEST(test_bearing_north);
  return UNITY_END();
}
