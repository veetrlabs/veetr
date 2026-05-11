#pragma once

struct GpsReadResult {
  bool newData = false;
  int bytesRead = 0;
};

template <typename SerialT, typename GpsT>
inline GpsReadResult readGpsStream(SerialT& serial, GpsT& gps, int maxBytes) {
  GpsReadResult result;

  while (serial.available() > 0 && result.bytesRead < maxBytes) {
    if (gps.encode(serial.read())) {
      result.newData = true;
    }
    result.bytesRead++;
  }

  return result;
}
