#include <unity.h>

#include "base64.h"

void setUp() {}
void tearDown() {}

void test_base64_basic() {
  uint8_t out[16] = {0};
  int len = base64Decode("TWFu", out, sizeof(out));
  TEST_ASSERT_EQUAL_INT(3, len);
  TEST_ASSERT_EQUAL_UINT8('M', out[0]);
  TEST_ASSERT_EQUAL_UINT8('a', out[1]);
  TEST_ASSERT_EQUAL_UINT8('n', out[2]);
}

void test_base64_padding_one() {
  uint8_t out[16] = {0};
  int len = base64Decode("TWE=", out, sizeof(out));
  TEST_ASSERT_EQUAL_INT(2, len);
  TEST_ASSERT_EQUAL_UINT8('M', out[0]);
  TEST_ASSERT_EQUAL_UINT8('a', out[1]);
}

void test_base64_padding_two() {
  uint8_t out[16] = {0};
  int len = base64Decode("TQ==", out, sizeof(out));
  TEST_ASSERT_EQUAL_INT(1, len);
  TEST_ASSERT_EQUAL_UINT8('M', out[0]);
}

void test_base64_invalid_length() {
  uint8_t out[16] = {0};
  int len = base64Decode("abc", out, sizeof(out));
  TEST_ASSERT_EQUAL_INT(-1, len);
}

void test_base64_output_capacity() {
  uint8_t out[2] = {0};
  int len = base64Decode("TWFu", out, sizeof(out));
  TEST_ASSERT_EQUAL_INT(-1, len);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_base64_basic);
  RUN_TEST(test_base64_padding_one);
  RUN_TEST(test_base64_padding_two);
  RUN_TEST(test_base64_invalid_length);
  RUN_TEST(test_base64_output_capacity);
  return UNITY_END();
}

