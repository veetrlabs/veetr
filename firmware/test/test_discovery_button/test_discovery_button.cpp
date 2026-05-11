#include <unity.h>

#include "discovery_button.h"

void setUp() {}
void tearDown() {}

void test_button_press_requires_debounce() {
  DiscoveryButtonState state;
  bool pressed = handleDiscoveryButtonPress(state, 0, 10, 50);

  TEST_ASSERT_FALSE(pressed);
}

void test_button_press_after_debounce() {
  DiscoveryButtonState state;
  handleDiscoveryButtonPress(state, 0, 10, 50);
  bool pressed = handleDiscoveryButtonPress(state, 0, 100, 50);

  TEST_ASSERT_TRUE(pressed);
}

void test_button_press_only_once_until_release() {
  DiscoveryButtonState state;
  handleDiscoveryButtonPress(state, 0, 10, 50);
  bool first = handleDiscoveryButtonPress(state, 0, 100, 50);
  bool second = handleDiscoveryButtonPress(state, 0, 200, 50);

  TEST_ASSERT_TRUE(first);
  TEST_ASSERT_FALSE(second);
}

void test_button_press_after_release() {
  DiscoveryButtonState state;
  handleDiscoveryButtonPress(state, 0, 10, 50);
  handleDiscoveryButtonPress(state, 0, 100, 50);
  handleDiscoveryButtonPress(state, 1, 200, 50);
  handleDiscoveryButtonPress(state, 1, 260, 50);
  bool pressed = handleDiscoveryButtonPress(state, 0, 300, 50);
  pressed = handleDiscoveryButtonPress(state, 0, 400, 50);

  TEST_ASSERT_TRUE(pressed);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_button_press_requires_debounce);
  RUN_TEST(test_button_press_after_debounce);
  RUN_TEST(test_button_press_only_once_until_release);
  RUN_TEST(test_button_press_after_release);
  return UNITY_END();
}
