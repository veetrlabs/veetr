#include <unity.h>

#include "ota_state.h"

void setUp() {}
void tearDown() {}

void test_reset_ota_state_clears_fields() {
  OtaState state;
  state.active = true;
  state.size = 1234;
  state.written = 42;
  state.startTimeMs = 999;

  resetOtaState(state);

  TEST_ASSERT_FALSE(state.active);
  TEST_ASSERT_EQUAL_UINT32(0u, state.size);
  TEST_ASSERT_EQUAL_UINT32(0u, state.written);
  TEST_ASSERT_EQUAL_UINT32(0u, state.startTimeMs);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_reset_ota_state_clears_fields);
  return UNITY_END();
}
