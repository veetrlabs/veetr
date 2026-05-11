#include <unity.h>

#include "ota_timeout.h"

void setUp() {}
void tearDown() {}

void test_timeout_status_basic() {
  OtaTimeoutStatus status = computeOtaTimeoutStatus(1000, 61000, 50, 60);

  TEST_ASSERT_EQUAL_UINT32(60000u, status.elapsedMs);
  TEST_ASSERT_EQUAL_UINT32(1u, status.elapsedMinutes);
  TEST_ASSERT_FALSE(status.shouldWarn);
  TEST_ASSERT_FALSE(status.timedOut);
}

void test_timeout_warns_at_threshold() {
  unsigned long start = 0;
  unsigned long now = 50UL * 60000UL;
  OtaTimeoutStatus status = computeOtaTimeoutStatus(start, now, 50, 60);

  TEST_ASSERT_TRUE(status.shouldWarn);
  TEST_ASSERT_FALSE(status.timedOut);
}

void test_timeout_triggers_at_limit() {
  unsigned long start = 0;
  unsigned long now = 60UL * 60000UL;
  OtaTimeoutStatus status = computeOtaTimeoutStatus(start, now, 50, 60);

  TEST_ASSERT_TRUE(status.shouldWarn);
  TEST_ASSERT_TRUE(status.timedOut);
}

void test_timeout_handles_time_rollback() {
  OtaTimeoutStatus status = computeOtaTimeoutStatus(1000, 500, 50, 60);

  TEST_ASSERT_EQUAL_UINT32(0u, status.elapsedMs);
  TEST_ASSERT_EQUAL_UINT32(0u, status.elapsedMinutes);
  TEST_ASSERT_FALSE(status.shouldWarn);
  TEST_ASSERT_FALSE(status.timedOut);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_timeout_status_basic);
  RUN_TEST(test_timeout_warns_at_threshold);
  RUN_TEST(test_timeout_triggers_at_limit);
  RUN_TEST(test_timeout_handles_time_rollback);
  return UNITY_END();
}
