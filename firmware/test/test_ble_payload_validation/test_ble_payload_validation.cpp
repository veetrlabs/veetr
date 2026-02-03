#include <unity.h>

#include "ble_payload_validation.h"

void setUp() {}
void tearDown() {}

void test_rejects_null() {
  TEST_ASSERT_FALSE(isBleJsonEnvelopeValid(nullptr, 0));
}

void test_rejects_too_short() {
  const char* payload = "{";
  TEST_ASSERT_FALSE(isBleJsonEnvelopeValid(payload, 1));
}

void test_accepts_minimal_json_object() {
  const char* payload = "{}";
  TEST_ASSERT_TRUE(isBleJsonEnvelopeValid(payload, 2));
}

void test_rejects_wrong_prefix_suffix() {
  const char* payload = "[]";
  TEST_ASSERT_FALSE(isBleJsonEnvelopeValid(payload, 2));
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_rejects_null);
  RUN_TEST(test_rejects_too_short);
  RUN_TEST(test_accepts_minimal_json_object);
  RUN_TEST(test_rejects_wrong_prefix_suffix);
  return UNITY_END();
}
