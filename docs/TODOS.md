# TODOs

This file tracks deferred ideas and improvements.

## BLE Payload / Telemetry (Deferred)
- Consider per-device RSSI reporting instead of a single shared `rssi` field.
- Evaluate rotating low-priority fields (e.g., accel/pitch/hdop/rssi) to keep core fields on every packet and reduce MTU pressure.
- If rotation is used, define a stable cadence and ensure core sailing data (SOG, wind, COG, GPS) is always present.

## Testing / Architecture (Deferred)
- Refactor shared helpers to avoid Arduino `String` so native tests don’t need a shim.
- Clamp BLE device names over 20 chars by trimming and truncating instead of rejecting.
