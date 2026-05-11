#pragma once

#include <ctype.h>
#include <string.h>

inline bool isAllowedDeviceNameChar(char c) {
  return (c >= 'A' && c <= 'Z') ||
      (c >= 'a' && c <= 'z') ||
      (c >= '0' && c <= '9') ||
      c == '_' || c == '-' || c == ' ';
}

inline size_t trimDeviceName(const char* input, char* output, size_t outputCap) {
  if (!output || outputCap == 0) {
    return 0;
  }
  if (!input) {
    output[0] = '\0';
    return 0;
  }

  const char* start = input;
  while (*start == ' ') {
    start++;
  }

  const char* end = input + strlen(input);
  while (end > start && *(end - 1) == ' ') {
    end--;
  }

  size_t len = static_cast<size_t>(end - start);
  if (len >= outputCap) {
    output[0] = '\0';
    return outputCap;
  }

  if (len > 0) {
    memcpy(output, start, len);
  }
  output[len] = '\0';
  return len;
}

inline bool isValidDeviceName(const char* name, size_t length, size_t maxLen) {
  if (!name || length == 0 || length > maxLen) {
    return false;
  }
  for (size_t i = 0; i < length; i++) {
    if (!isAllowedDeviceNameChar(name[i])) {
      return false;
    }
  }
  return true;
}
