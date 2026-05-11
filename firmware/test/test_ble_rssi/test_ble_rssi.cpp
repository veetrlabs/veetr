#include <unity.h>

#include "ble_rssi.h"

void setUp() {}
void tearDown() {}

void test_rssi_no_connection_resets() {
  BleRssiState state;
  updateBleRssiState(state, 3000, false, false, false, 0);
  TEST_ASSERT_EQUAL_INT(0, state.current);
  TEST_ASSERT_EQUAL_INT(0, state.filtered);
}

void test_rssi_initializes_window() {
  BleRssiState state;
  updateBleRssiState(state, 3000, true, true, true, -40);
  TEST_ASSERT_EQUAL_INT(-40, state.current);
  TEST_ASSERT_EQUAL_INT(-40, state.filtered);
}

void test_rssi_smooths_over_window() {
  BleRssiState state;
  updateBleRssiState(state, 3000, true, true, true, -50);
  updateBleRssiState(state, 6000, true, true, true, -60);
  updateBleRssiState(state, 9000, true, true, true, -70);
  TEST_ASSERT_EQUAL_INT(-56, state.filtered);
}

void test_rssi_read_fail_sets_fallback() {
  BleRssiState state;
  updateBleRssiState(state, 3000, true, true, false, 0);
  TEST_ASSERT_EQUAL_INT(-50, state.current);
  TEST_ASSERT_EQUAL_INT(-50, state.filtered);
}

void test_rssi_throttle_ignores_fast_updates() {
  BleRssiState state;
  updateBleRssiState(state, 3000, true, true, true, -40);
  updateBleRssiState(state, 4000, true, true, true, -80);
  TEST_ASSERT_EQUAL_INT(-40, state.current);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_rssi_no_connection_resets);
  RUN_TEST(test_rssi_initializes_window);
  RUN_TEST(test_rssi_smooths_over_window);
  RUN_TEST(test_rssi_read_fail_sets_fallback);
  RUN_TEST(test_rssi_throttle_ignores_fast_updates);
  return UNITY_END();
}
