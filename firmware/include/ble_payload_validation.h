#pragma once

inline bool isBleJsonEnvelopeValid(const char* payload, size_t length) {
  if (!payload || length < 2) {
    return false;
  }
  return payload[0] == '{' && payload[length - 1] == '}';
}
