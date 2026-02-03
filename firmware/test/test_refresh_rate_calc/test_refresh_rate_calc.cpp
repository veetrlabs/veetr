#include <unity.h>

#include "refresh_rate_calc.h"

void setUp() {}
void tearDown() {}

void test_clamp_refresh_rate_in_range() {
  int ms = clampRefreshRateMs(1.25f, 500, 2000);

  TEST_ASSERT_EQUAL_INT(1250, ms);
}

void test_clamp_refresh_rate_low() {
  int ms = clampRefreshRateMs(0.1f, 500, 2000);

  TEST_ASSERT_EQUAL_INT(500, ms);
}

void test_clamp_refresh_rate_high() {
  int ms = clampRefreshRateMs(3.5f, 500, 2000);

  TEST_ASSERT_EQUAL_INT(2000, ms);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_clamp_refresh_rate_in_range);
  RUN_TEST(test_clamp_refresh_rate_low);
  RUN_TEST(test_clamp_refresh_rate_high);
  return UNITY_END();
}
