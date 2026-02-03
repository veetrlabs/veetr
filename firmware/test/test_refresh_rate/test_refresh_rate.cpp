#include <unity.h>

#include "refresh_rate.h"

void setUp() {}
void tearDown() {}

void test_validate_refresh_rate_accepts_in_range() {
  float out = 0.0f;

  bool ok = validateRefreshRate(1.25f, 0.5f, 2.0f, out);

  TEST_ASSERT_TRUE(ok);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.25f, out);
}

void test_validate_refresh_rate_rejects_low() {
  float out = 0.0f;

  bool ok = validateRefreshRate(0.25f, 0.5f, 2.0f, out);

  TEST_ASSERT_FALSE(ok);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, out);
}

void test_validate_refresh_rate_rejects_high() {
  float out = 0.0f;

  bool ok = validateRefreshRate(2.5f, 0.5f, 2.0f, out);

  TEST_ASSERT_FALSE(ok);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, out);
}

void test_refresh_rate_ms() {
  unsigned long ms = refreshRateMs(1.5f);

  TEST_ASSERT_EQUAL_UINT32(1500u, ms);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_validate_refresh_rate_accepts_in_range);
  RUN_TEST(test_validate_refresh_rate_rejects_low);
  RUN_TEST(test_validate_refresh_rate_rejects_high);
  RUN_TEST(test_refresh_rate_ms);
  return UNITY_END();
}
