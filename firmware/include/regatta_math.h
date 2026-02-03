#pragma once

#include <math.h>

inline float haversineDistance(double lat1, double lon1, double lat2, double lon2) {
  const double R = 6371000.0; // Earth radius in meters

  double dLat = (lat2 - lat1) * M_PI / 180.0;
  double dLon = (lon2 - lon1) * M_PI / 180.0;

  double a = sin(dLat / 2) * sin(dLat / 2) +
             cos(lat1 * M_PI / 180.0) * cos(lat2 * M_PI / 180.0) *
             sin(dLon / 2) * sin(dLon / 2);

  double c = 2 * atan2(sqrt(a), sqrt(1 - a));

  return static_cast<float>(R * c);
}

struct RegattaLine {
  bool hasStartLine = false;
  double portLat = 0.0;
  double portLon = 0.0;
  double starboardLat = 0.0;
  double starboardLon = 0.0;
};

struct GpsFix {
  bool valid = false;
  double lat = 0.0;
  double lon = 0.0;
};

inline float distanceToLine(double px, double py, double x1, double y1, double x2, double y2) {
  double dx = x2 - x1;
  double dy = y2 - y1;

  if (dx == 0 && dy == 0) {
    return haversineDistance(px, py, x1, y1);
  }

  double t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  if (t < 0.0) t = 0.0;
  if (t > 1.0) t = 1.0;

  double closestX = x1 + t * dx;
  double closestY = y1 + t * dy;

  return haversineDistance(px, py, closestX, closestY);
}

inline float calculateRegattaDistance(const RegattaLine& line, const GpsFix& gps) {
  if (!line.hasStartLine || !gps.valid) {
    return NAN;
  }

  return distanceToLine(gps.lat, gps.lon, line.portLat, line.portLon, line.starboardLat, line.starboardLon);
}
