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

void test_heading_yaw_90_degrees() {
  float heading = 0.0f;
  float half = kPi * 0.25f;
  float quatK = sinf(half);
  float quatReal = cosf(half);
  bool ok = computeHeadingDegreesFromQuaternion(0.0f, 0.0f, quatK, quatReal, heading);

  TEST_ASSERT_TRUE(ok);
  TEST_ASSERT_FLOAT_WITHIN(0.1f, 90.0f, heading);
}

void test_heading_rejects_zero_quaternion() {
  float heading = 0.0f;
  bool ok = computeHeadingDegreesFromQuaternion(0.0f, 0.0f, 0.0f, 0.0f, heading);

  TEST_ASSERT_FALSE(ok);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_roll_pitch_level);
  RUN_TEST(test_roll_pitch_right_heel);
  RUN_TEST(test_heading_identity_quaternion);
  RUN_TEST(test_heading_yaw_90_degrees);
  RUN_TEST(test_heading_rejects_zero_quaternion);
  return UNITY_END();
}
