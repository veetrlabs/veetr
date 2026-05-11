#pragma once

#include <stdint.h>
#include <string.h>

static const char kBase64Chars[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

inline int base64Decode(const char* input, uint8_t* output, size_t outputCapacity) {
  int inputLen = static_cast<int>(strlen(input));
  if (inputLen % 4 != 0) return -1;

  int outputLen = inputLen / 4 * 3;
  if (inputLen >= 1 && input[inputLen - 1] == '=') outputLen--;
  if (inputLen >= 2 && input[inputLen - 2] == '=') outputLen--;

  if (outputLen < 0 || static_cast<size_t>(outputLen) > outputCapacity) {
    return -1;
  }

  int i = 0;
  int j = 0;
  while (i < inputLen) {
    uint32_t sextet_a = input[i] == '=' ? 0u : static_cast<uint32_t>(strchr(kBase64Chars, input[i]) - kBase64Chars);
    i++;
    uint32_t sextet_b = input[i] == '=' ? 0u : static_cast<uint32_t>(strchr(kBase64Chars, input[i]) - kBase64Chars);
    i++;
    uint32_t sextet_c = input[i] == '=' ? 0u : static_cast<uint32_t>(strchr(kBase64Chars, input[i]) - kBase64Chars);
    i++;
    uint32_t sextet_d = input[i] == '=' ? 0u : static_cast<uint32_t>(strchr(kBase64Chars, input[i]) - kBase64Chars);
    i++;

    uint32_t triple = (sextet_a << 18) + (sextet_b << 12) + (sextet_c << 6) + sextet_d;

    if (j < outputLen) output[j++] = (triple >> 16) & 0xFF;
    if (j < outputLen) output[j++] = (triple >> 8) & 0xFF;
    if (j < outputLen) output[j++] = triple & 0xFF;
  }

  return outputLen;
}
