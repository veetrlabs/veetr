#include <unity.h>

#include <ArduinoJson.h>

#include "ble_command.h"

void setUp() {}
void tearDown() {}

void test_parse_command_with_action_and_cmd() {
  StaticJsonDocument<128> doc;
  DeserializationError err = deserializeJson(doc, "{\"action\":\"resetHeelAngle\",\"cmd\":\"PING\"}");
  TEST_ASSERT_FALSE(err);
  BleCommand cmd;

  bool ok = parseBleCommandDoc(doc, cmd);

  TEST_ASSERT_TRUE(ok);
  TEST_ASSERT_EQUAL_STRING("resetHeelAngle", cmd.action.c_str());
  TEST_ASSERT_EQUAL_STRING("PING", cmd.cmd.c_str());
  TEST_ASSERT_FALSE(cmd.hasIndex);
}

void test_parse_command_with_index() {
  StaticJsonDocument<128> doc;
  DeserializationError err = deserializeJson(doc, "{\"cmd\":\"FW_CHUNK\",\"index\":5}");
  TEST_ASSERT_FALSE(err);
  BleCommand cmd;

  bool ok = parseBleCommandDoc(doc, cmd);

  TEST_ASSERT_TRUE(ok);
  TEST_ASSERT_EQUAL_STRING("", cmd.action.c_str());
  TEST_ASSERT_EQUAL_STRING("FW_CHUNK", cmd.cmd.c_str());
  TEST_ASSERT_TRUE(cmd.hasIndex);
  TEST_ASSERT_EQUAL_INT(5, cmd.index);
}

void test_parse_command_missing_fields() {
  StaticJsonDocument<64> doc;
  DeserializationError err = deserializeJson(doc, "{\"foo\":1}");
  TEST_ASSERT_FALSE(err);
  BleCommand cmd;

  bool ok = parseBleCommandDoc(doc, cmd);

  TEST_ASSERT_FALSE(ok);
}

void test_parse_command_rejects_non_object() {
  StaticJsonDocument<64> doc;
  DeserializationError err = deserializeJson(doc, "null");
  TEST_ASSERT_FALSE(err);
  BleCommand cmd;

  bool ok = parseBleCommandDoc(doc, cmd);

  TEST_ASSERT_FALSE(ok);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_parse_command_with_action_and_cmd);
  RUN_TEST(test_parse_command_with_index);
  RUN_TEST(test_parse_command_missing_fields);
  RUN_TEST(test_parse_command_rejects_non_object);
  return UNITY_END();
}
