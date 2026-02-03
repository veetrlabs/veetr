#pragma once

#include <ArduinoJson.h>
#include <stdint.h>

#ifdef ARDUINO
#include <WString.h>
#else
#include "ble_string.h"
#endif

#include "ota_chunk.h"
#include "ota_state.h"

struct OtaBackend {
  bool (*begin)(uint32_t size);
  bool (*isRunning)();
  void (*abort)();
  size_t (*write)(const uint8_t* data, size_t length);
  bool (*end)(bool evenIfRemaining);
  const char* (*errorString)();
  uint8_t (*getError)();
};

struct OtaResponse {
  const char* type = "";
  const char* message = nullptr;
  bool hasMessage = false;
  bool hasIndex = false;
  int index = 0;
  bool hasWritten = false;
  uint32_t written = 0;
  bool hasProgress = false;
  float progress = 0.0f;
};

struct OtaStatus {
  bool active = false;
  unsigned long elapsedMs = 0;
  uint32_t written = 0;
  uint32_t size = 0;
  bool hasProgress = false;
  float progress = 0.0f;
};

class BleOtaHandler {
 public:
  bool handleStart(JsonObjectConst doc, OtaBackend& backend, OtaState& state,
                   unsigned long nowMs, OtaResponse& response) {
    if (!doc.containsKey("size")) {
      response = errorResponse("Firmware size required");
      return false;
    }

    state.size = doc["size"].as<uint32_t>();
    if (backend.isRunning && backend.isRunning()) {
      backend.abort();
    }

    if (!backend.begin(state.size)) {
      response = errorResponse("Failed to begin update");
      return false;
    }

    state.active = true;
    state.startTimeMs = nowMs;
    state.written = 0;
    response.type = "update_ready";
    return true;
  }

  void handleStop(OtaBackend& backend, OtaState& state, OtaResponse& response) {
    if (state.active) {
      backend.abort();
    }
    resetOtaState(state);
    response.type = "update_stopped";
  }

  void handleStatus(OtaState& state, unsigned long nowMs, OtaStatus& status) {
    status.active = state.active;
    if (state.active && state.startTimeMs > 0) {
      status.elapsedMs = nowMs - state.startTimeMs;
      status.written = state.written;
      status.size = state.size;
      if (state.size > 0) {
        status.hasProgress = true;
        status.progress = static_cast<float>(state.written) / state.size * 100.0f;
      }
    }
  }

  bool handleChunk(JsonObjectConst doc, OtaBackend& backend, OtaState& state,
                   OtaResponse& response) {
    if (!state.active) {
      response = errorResponse("Update not active");
      return false;
    }

    if (!doc.containsKey("data")) {
      response = errorResponse("No chunk data");
      return false;
    }

    int chunkIndex = doc["index"] | 0;
    String dataB64 = doc["data"].as<const char*>();
    OtaChunk chunk;
    if (!decodeOtaChunk(dataB64, chunk)) {
      response = errorResponse("Base64 decode failed");
      return false;
    }

    size_t written = backend.write(chunk.data, chunk.length);
    freeOtaChunk(chunk);

    if (written != static_cast<size_t>(chunk.length)) {
      response = errorResponse("Write failed");
      return false;
    }

    state.written += written;
    response.type = "chunk_ack";
    response.hasIndex = true;
    response.index = chunkIndex;
    response.hasWritten = true;
    response.written = state.written;
    if (state.size > 0) {
      response.hasProgress = true;
      response.progress = static_cast<float>(state.written) / state.size * 100.0f;
    }
    return true;
  }

  bool handleVerify(OtaBackend& backend, OtaState& state, OtaResponse& response) {
    if (!state.active) {
      response = errorResponse("Update not active");
      return false;
    }

    if (backend.end(true)) {
      response.type = "update_complete";
      response.message = "Firmware verified and ready to apply";
      response.hasMessage = true;
      resetOtaState(state);
      return true;
    }

    response = errorResponse("Verification failed");
    resetOtaState(state);
    return false;
  }

  void handleApply(OtaResponse& response) {
    response.type = "restarting";
    response.message = "Applying firmware update";
    response.hasMessage = true;
  }

 private:
  OtaResponse errorResponse(const char* message) {
    OtaResponse response;
    response.type = "error";
    response.message = message;
    response.hasMessage = true;
    return response;
  }
};
