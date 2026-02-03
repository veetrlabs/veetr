#include <unity.h>

#include "regatta_math.h"

void setUp() {}
void tearDown() {}

void test_no_line_returns_nan() {
  RegattaLine line = {false, 0.0, 0.0, 1.0, 1.0};
  GpsFix fix = {true, 1.0, 1.0};
  float d = calculateRegattaDistance(line, fix);
  TEST_ASSERT_TRUE(isnan(d));
}

void test_no_gps_returns_nan() {
  RegattaLine line = {true, 0.0, 0.0, 1.0, 1.0};
  GpsFix fix = {false, 1.0, 1.0};
  float d = calculateRegattaDistance(line, fix);
  TEST_ASSERT_TRUE(isnan(d));
}

void test_valid_line_returns_distance() {
  RegattaLine line = {true, 0.0, 0.0, 0.0, 1.0};
  GpsFix fix = {true, 1.0, 0.5};
  float d = calculateRegattaDistance(line, fix);
  TEST_ASSERT_FALSE(isnan(d));
  TEST_ASSERT_FLOAT_WITHIN(300.0f, 111190.0f, d);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_no_line_returns_nan);
  RUN_TEST(test_no_gps_returns_nan);
  RUN_TEST(test_valid_line_returns_distance);
  return UNITY_END();
}
