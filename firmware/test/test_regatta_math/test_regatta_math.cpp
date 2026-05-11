#include <unity.h>

#include "regatta_math.h"

void setUp() {}
void tearDown() {}

void test_haversine_zero_distance() {
  float d = haversineDistance(0.0, 0.0, 0.0, 0.0);
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 0.0f, d);
}

void test_haversine_known_distance() {
  // Approx distance for 1 degree latitude ~ 111.19 km
  float d = haversineDistance(0.0, 0.0, 1.0, 0.0);
  TEST_ASSERT_FLOAT_WITHIN(200.0f, 111190.0f, d);
}

void test_distance_to_line_endpoint() {
  float d = distanceToLine(0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 0.0f, d);
}

void test_distance_to_line_midpoint() {
  // Line from (0,0) to (0,1), point at (1,0.5) should be ~111.19 km away
  float d = distanceToLine(1.0, 0.5, 0.0, 0.0, 0.0, 1.0);
  TEST_ASSERT_FLOAT_WITHIN(300.0f, 111190.0f, d);
}

void test_distance_to_line_clamps_outside_segment() {
  // Point beyond end of line: should clamp to endpoint distance
  float d = distanceToLine(2.0, 0.0, 0.0, 0.0, 1.0, 0.0);
  float endpoint = haversineDistance(2.0, 0.0, 1.0, 0.0);
  TEST_ASSERT_FLOAT_WITHIN(1.0f, endpoint, d);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_haversine_zero_distance);
  RUN_TEST(test_haversine_known_distance);
  RUN_TEST(test_distance_to_line_endpoint);
  RUN_TEST(test_distance_to_line_midpoint);
  RUN_TEST(test_distance_to_line_clamps_outside_segment);
  return UNITY_END();
}

