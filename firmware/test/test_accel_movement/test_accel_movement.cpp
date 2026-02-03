#include <unity.h>

#include "accel_movement.h"

void setUp() {}
void tearDown() {}

void test_detects_no_movement_for_stable_gravity() {
  float magnitudes[] = {9.7f, 9.8f, 9.9f, 9.8f, 9.7f};
  AccelStats stats;
  bool moving = detectAccelMovement(magnitudes, 5, 0.5f, 1.0f, 8.0f, 12.0f, &stats);

  TEST_ASSERT_FALSE(moving);
  TEST_ASSERT_TRUE(stats.hasData);
}

void test_detects_movement_for_high_variance() {
  float magnitudes[] = {8.5f, 10.5f, 9.8f, 11.0f, 8.8f};
  AccelStats stats;
  bool moving = detectAccelMovement(magnitudes, 5, 0.5f, 1.0f, 8.0f, 12.0f, &stats);

  TEST_ASSERT_TRUE(moving);
}

void test_rejects_invalid_average() {
  float magnitudes[] = {2.0f, 2.1f, 2.2f};
  AccelStats stats;
  bool moving = detectAccelMovement(magnitudes, 3, 0.5f, 1.0f, 8.0f, 12.0f, &stats);

  TEST_ASSERT_FALSE(moving);
  TEST_ASSERT_TRUE(stats.hasData);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_detects_no_movement_for_stable_gravity);
  RUN_TEST(test_detects_movement_for_high_variance);
  RUN_TEST(test_rejects_invalid_average);
  return UNITY_END();
}
