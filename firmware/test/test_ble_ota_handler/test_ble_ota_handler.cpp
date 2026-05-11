#include <unity.h>

#include <ArduinoJson.h>

#include "ble_ota_handler.h"

struct FakeBackendState {
  bool beginOk = true;
  bool running = false;
  bool endOk = true;
  size_t writeReturn = 0;
  uint8_t error = 0;
};

static FakeBackendState backendState;

static bool fakeBegin(uint32_t size) {
  (void)size;
  return backendState.beginOk;
}
static bool fakeIsRunning() { return backendState.running; }
static void fakeAbort() { backendState.running = false; }
static size_t fakeWrite(const uint8_t*, size_t length) { return backendState.writeReturn ? backendState.writeReturn : length; }
static bool fakeEnd(bool) { return backendState.endOk; }
static const char* fakeErrorString() { return "fake error"; }
static uint8_t fakeGetError() { return backendState.error; }

static OtaBackend makeBackend() {
  OtaBackend backend = {
    fakeBegin,
    fakeIsRunning,
    fakeAbort,
    fakeWrite,
    fakeEnd,
    fakeErrorString,
    fakeGetError
  };
  return backend;
}

void setUp() {
  backendState = FakeBackendState();
}

void tearDown() {}

void test_start_requires_size() {
  StaticJsonDocument<64> doc;
  deserializeJson(doc, "{}");
  OtaState state;
  OtaResponse response;
  BleOtaHandler handler;
  OtaBackend backend = makeBackend();

  bool ok = handler.handleStart(doc.as<JsonObjectConst>(), backend, state, 1000, response);

  TEST_ASSERT_FALSE(ok);
  TEST_ASSERT_EQUAL_STRING("error", response.type);
  TEST_ASSERT_TRUE(response.hasMessage);
  TEST_ASSERT_EQUAL_STRING("Firmware size required", response.message);
}

void test_start_sets_state() {
  StaticJsonDocument<64> doc;
  deserializeJson(doc, "{\"size\":1024}");
  OtaState state;
  OtaResponse response;
  BleOtaHandler handler;
  OtaBackend backend = makeBackend();

  bool ok = handler.handleStart(doc.as<JsonObjectConst>(), backend, state, 500, response);

  TEST_ASSERT_TRUE(ok);
  TEST_ASSERT_TRUE(state.active);
  TEST_ASSERT_EQUAL_UINT32(1024u, state.size);
  TEST_ASSERT_EQUAL_UINT32(0u, state.written);
  TEST_ASSERT_EQUAL_UINT32(500u, state.startTimeMs);
  TEST_ASSERT_EQUAL_STRING("update_ready", response.type);
}

void test_chunk_rejects_when_inactive() {
  StaticJsonDocument<128> doc;
  deserializeJson(doc, "{\"index\":1,\"data\":\"QQ==\"}");
  OtaState state;
  OtaResponse response;
  BleOtaHandler handler;
  OtaBackend backend = makeBackend();

  bool ok = handler.handleChunk(doc.as<JsonObjectConst>(), backend, state, response);

  TEST_ASSERT_FALSE(ok);
  TEST_ASSERT_EQUAL_STRING("error", response.type);
  TEST_ASSERT_EQUAL_STRING("Update not active", response.message);
}

void test_chunk_base64_failure() {
  StaticJsonDocument<128> doc;
  deserializeJson(doc, "{\"index\":1,\"data\":\"@@@\"}");
  OtaState state;
  state.active = true;
  state.size = 4;
  OtaResponse response;
  BleOtaHandler handler;
  OtaBackend backend = makeBackend();

  bool ok = handler.handleChunk(doc.as<JsonObjectConst>(), backend, state, response);

  TEST_ASSERT_FALSE(ok);
  TEST_ASSERT_EQUAL_STRING("Base64 decode failed", response.message);
}

void test_verify_failure() {
  StaticJsonDocument<32> doc;
  (void)doc;
  OtaState state;
  state.active = true;
  state.size = 4;
  OtaResponse response;
  BleOtaHandler handler;
  OtaBackend backend = makeBackend();
  backendState.endOk = false;

  bool ok = handler.handleVerify(backend, state, response);

  TEST_ASSERT_FALSE(ok);
  TEST_ASSERT_EQUAL_STRING("error", response.type);
  TEST_ASSERT_EQUAL_STRING("Verification failed", response.message);
  TEST_ASSERT_FALSE(state.active);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_start_requires_size);
  RUN_TEST(test_start_sets_state);
  RUN_TEST(test_chunk_rejects_when_inactive);
  RUN_TEST(test_chunk_base64_failure);
  RUN_TEST(test_verify_failure);
  return UNITY_END();
}
