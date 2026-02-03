#include <unity.h>

#include "discovery_status.h"

void setUp() {}
void tearDown() {}

void test_discovery_times_out() {
  DiscoveryBlinkStatus status = computeDiscoveryBlink(0, 600001, 600000, 3000, 1000, 0);

  TEST_ASSERT_TRUE(status.timedOut);
  TEST_ASSERT_FALSE(status.shouldToggle);
}

void test_discovery_no_blink_before_delay() {
  DiscoveryBlinkStatus status = computeDiscoveryBlink(0, 2000, 600000, 3000, 1000, 0);

  TEST_ASSERT_FALSE(status.timedOut);
  TEST_ASSERT_FALSE(status.shouldToggle);
}

void test_discovery_blink_after_interval() {
  DiscoveryBlinkStatus status = computeDiscoveryBlink(0, 5000, 600000, 3000, 1000, 3000);

  TEST_ASSERT_FALSE(status.timedOut);
  TEST_ASSERT_TRUE(status.shouldToggle);
  TEST_ASSERT_EQUAL_UINT32(5000u, status.nextLastBlinkMs);
}

void test_discovery_no_toggle_if_interval_not_reached() {
  DiscoveryBlinkStatus status = computeDiscoveryBlink(0, 4500, 600000, 3000, 1000, 4000);

  TEST_ASSERT_FALSE(status.timedOut);
  TEST_ASSERT_FALSE(status.shouldToggle);
  TEST_ASSERT_EQUAL_UINT32(4000u, status.nextLastBlinkMs);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_discovery_times_out);
  RUN_TEST(test_discovery_no_blink_before_delay);
  RUN_TEST(test_discovery_blink_after_interval);
  RUN_TEST(test_discovery_no_toggle_if_interval_not_reached);
  return UNITY_END();
}
