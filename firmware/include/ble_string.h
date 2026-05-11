#pragma once

#include <stdlib.h>
#include <string.h>

// NOTE: This minimal String shim exists only to allow native unit tests to
// compile code that uses Arduino's WString. Production builds use WString.h.
// TODO: Refactor firmware to avoid Arduino String in shared helpers so this
// shim can be removed.

class String {
 public:
  String() { initEmpty(); }
  String(const char* s) { initEmpty(); assign(s); }
  String(const String& other) { initEmpty(); assign(other.c_str()); }
  ~String() { free(buf_); }

  String& operator=(const char* s) {
    assign(s);
    return *this;
  }

  String& operator=(const String& other) {
    assign(other.c_str());
    return *this;
  }

  size_t length() const { return len_; }
  const char* c_str() const { return buf_; }

  void clear() { assign(""); }

 private:
  char* buf_ = nullptr;
  size_t len_ = 0;
  size_t cap_ = 0;

  void initEmpty() {
    reserve(1);
    buf_[0] = '\0';
    len_ = 0;
  }

  bool reserve(size_t cap) {
    if (cap <= cap_) {
      return true;
    }
    char* next = static_cast<char*>(realloc(buf_, cap));
    if (!next) {
      return false;
    }
    buf_ = next;
    cap_ = cap;
    return true;
  }

  void assign(const char* s) {
    if (!s) {
      s = "";
    }
    size_t nextLen = strlen(s);
    if (!reserve(nextLen + 1)) {
      return;
    }
    memcpy(buf_, s, nextLen);
    buf_[nextLen] = '\0';
    len_ = nextLen;
  }
};
