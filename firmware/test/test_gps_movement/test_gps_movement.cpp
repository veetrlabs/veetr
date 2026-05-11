#include <unity.h>

#include "gps_movement.h"

void setUp() {}
void tearDown() {}

void test_stationary_track_is_false() {
  GpsTrackPoint points[] = {
    {0.0, 0.0, true},
    {0.0, 0.00001, true},
    {0.0, 0.00002, true},
    {0.0, 0.00003, true},
  };

  bool moving = isGpsMovementConsistentTrack(points, 4, 3.0f, 5.0f, 45.0f);

  TEST_ASSERT_FALSE(moving);
}

void test_consistent_movement_is_true() {
  GpsTrackPoint points[] = {
    {0.0, 0.0, true},
    {0.0, 0.0001, true},
    {0.0, 0.0002, true},
    {0.0, 0.0003, true},
  };

  bool moving = isGpsMovementConsistentTrack(points, 4, 3.0f, 5.0f, 45.0f);

  TEST_ASSERT_TRUE(moving);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_stationary_track_is_false);
  RUN_TEST(test_consistent_movement_is_true);
  return UNITY_END();
}
