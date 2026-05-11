#include <unity.h>

#include <string.h>

#include "ble_device_name.h"

void setUp() {}
void tearDown() {}

void test_trim_device_name_removes_outer_spaces() {
  char output[21];
  size_t len = trimDeviceName("  My Boat  ", output, sizeof(output));

  TEST_ASSERT_EQUAL_INT(7, len);
  TEST_ASSERT_EQUAL_STRING("My Boat", output);
}

void test_trim_device_name_all_spaces_is_empty() {
  char output[21];
  size_t len = trimDeviceName("     ", output, sizeof(output));

  TEST_ASSERT_EQUAL_INT(0, len);
  TEST_ASSERT_EQUAL_STRING("", output);
}

void test_trim_device_name_overflow_marks_invalid() {
  char output[21];
  size_t len = trimDeviceName("123456789012345678901", output, sizeof(output));

  TEST_ASSERT_EQUAL_INT(sizeof(output), len);
  TEST_ASSERT_EQUAL_STRING("", output);
}

void test_is_valid_device_name_accepts_allowed_chars() {
  const char* name = "Veetr_01-A";
  size_t len = strlen(name);

  TEST_ASSERT_TRUE(isValidDeviceName(name, len, 20));
}

void test_is_valid_device_name_rejects_invalid_chars() {
  const char* name = "Boat!";
  size_t len = strlen(name);

  TEST_ASSERT_FALSE(isValidDeviceName(name, len, 20));
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_trim_device_name_removes_outer_spaces);
  RUN_TEST(test_trim_device_name_all_spaces_is_empty);
  RUN_TEST(test_trim_device_name_overflow_marks_invalid);
  RUN_TEST(test_is_valid_device_name_accepts_allowed_chars);
  RUN_TEST(test_is_valid_device_name_rejects_invalid_chars);
  return UNITY_END();
}
