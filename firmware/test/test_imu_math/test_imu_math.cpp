#include <unity.h>

#include <math.h>

#include "imu_math.h"

void setUp() {}
void tearDown() {}

void test_roll_pitch_level() {
  float roll = 0.0f;
  float pitch = 0.0f;
  computeRollPitchDegrees(0.0f, 0.0f, 9.8f, roll, pitch);

  TEST_ASSERT_FLOAT_WITHIN(0.1f, 0.0f, roll);
  TEST_ASSERT_FLOAT_WITHIN(0.1f, 0.0f, pitch);
}

void test_roll_pitch_right_heel() {
  float roll = 0.0f;
  float pitch = 0.0f;
  computeRollPitchDegrees(9.8f, 0.0f, 0.0f, roll, pitch);

  TEST_ASSERT_FLOAT_WITHIN(0.1f, 90.0f, roll);
  TEST_ASSERT_FLOAT_WITHIN(0.1f, 0.0f, pitch);
}

void test_heading_identity_quaternion() {
  float heading = 0.0f;
  bool ok = computeHeadingDegreesFromQuaternion(0.0f, 0.0f, 0.0f, 1.0f, heading);

  TEST_ASSERT_TRUE(ok);
  TEST_ASSERT_FLOAT_WITHIN(0.1f, 0.0f, heading);
}

void test_counterclockwise_turn_is_west() {
  float heading = 0.0f;
  float half = kPi * 0.25f;
  float quatK = sinf(half);
  float quatReal = cosf(half);
  bool ok = computeHeadingDegreesFromQuaternion(0.0f, 0.0f, quatK, quatReal, heading);

  TEST_ASSERT_TRUE(ok);
  TEST_ASSERT_FLOAT_WITHIN(0.1f, 270.0f, heading);
}

void test_clockwise_turn_is_east() {
  float heading;
  TEST_ASSERT_TRUE(computeHeadingDegreesFromQuaternion(0, 0, -sinf(kPi/4), cosf(kPi/4), heading));
  TEST_ASSERT_FLOAT_WITHIN(.01, 90, heading);
}

void test_north_marker_cancels_physical_turn() {
  for (int ccw = -179; ccw <= 179; ccw += 13) {
    const float half = ccw * kPi / 360;
    float heading;
    TEST_ASSERT_TRUE(computeHeadingDegreesFromQuaternion(0, 0, sinf(half), cosf(half), heading));
    // Display angles are clockwise: physical device turn is -ccw,
    // its north marker is -heading. Their world angle must stay zero.
    TEST_ASSERT_FLOAT_WITHIN(.01, 0, remainderf(-ccw - heading, 360));
  }
}

void test_heading_rejects_zero_quaternion() {
  float heading = 0.0f;
  bool ok = computeHeadingDegreesFromQuaternion(0.0f, 0.0f, 0.0f, 0.0f, heading);

  TEST_ASSERT_FALSE(ok);
}

void test_heading_rejects_nonfinite_and_corrupt_quaternion() {
  float heading = 123;
  TEST_ASSERT_FALSE(computeHeadingDegreesFromQuaternion(NAN, 0, 0, 1, heading));
  TEST_ASSERT_FALSE(computeHeadingDegreesFromQuaternion(0, 0, 0, INFINITY, heading));
  TEST_ASSERT_FALSE(computeHeadingDegreesFromQuaternion(0, 0, 0, .5, heading));
  TEST_ASSERT_FLOAT_WITHIN(.01, 123, heading);
}
int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_heading_rejects_nonfinite_and_corrupt_quaternion);
  RUN_TEST(test_roll_pitch_level);
  RUN_TEST(test_roll_pitch_right_heel);
  RUN_TEST(test_heading_identity_quaternion);
  RUN_TEST(test_counterclockwise_turn_is_west);
  RUN_TEST(test_clockwise_turn_is_east);
  RUN_TEST(test_north_marker_cancels_physical_turn);
  RUN_TEST(test_heading_rejects_zero_quaternion);
  return UNITY_END();
}
