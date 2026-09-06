---
title: PlatformIO configuration
description: Build, upload, monitor, and troubleshoot Veetr firmware with PlatformIO.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/PLATFORMIO.md
---

This project uses PlatformIO for ESP32 firmware development with a unified configuration at the root level.

## Project Structure

```
veetr/
├── platformio.ini           # PlatformIO configuration (root level)
├── firmware/
│   ├── src/                 # Source code
│   ├── include/             # Header files
│   ├── lib/                 # Custom libraries
│   └── test/                # Test files
└── .vscode/
    └── tasks.json           # VS Code tasks for PlatformIO
```

## Configuration Details

### Target Hardware:
- **Board**: ESP32 DevKitC WROOM-32U ([detailed specs](https://veetr.org/docs/hardware/))
- **Platform**: Espressif32 v6.4.0+
- **Framework**: Arduino
- **Monitor Speed**: 115200 baud

### Installed Libraries:
- **ArduinoJson** v6.21.2+ - JSON serialization
- **SparkFun BNO080** - IMU/orientation sensor
- **TinyGPSPlus** v1.0.3+ - GPS data parsing
- **ModbusMaster** v2.0.1+ - RS485 sensor communication
- **NimBLE-Arduino** v1.4.2+ - Bluetooth Low Energy

### Build Flags:
- **Debug Level**: 1 (minimal debug output)
- **PSRAM Support**: Enabled for additional memory
- **Optimization**: `-Os` (size optimization)
- **BLE Configuration**: 4 max connections, optimized logging

## Development Workflow

For complete development setup and daily workflow, see the **[Development Guide](https://veetr.org/docs/development/)**.

This document focuses on PlatformIO-specific configuration and troubleshooting.

## Build Commands Reference

From the root directory (not the firmware subdirectory):
```bash
pio run                    # Build firmware
pio run --target upload    # Upload to ESP32
pio device monitor         # Serial monitor
pio run --target clean     # Clean build files
```

## PlatformIO IDE Integration
For full PlatformIO IDE experience:
```bash
cd firmware && code .
```
This opens the firmware folder as a dedicated PlatformIO project.

## Memory Usage

Current firmware uses approximately:
- **RAM**: 11.6% (38,076 / 327,680 bytes)
- **Flash**: 52.1% (683,397 / 1,310,720 bytes)

Plenty of space remaining for additional features and sensors ([see sensor options](https://veetr.org/docs/hardware/)).

## Adding New Libraries

To add a new library, edit `platformio.ini`:
```ini
lib_deps = 
    bblanchon/ArduinoJson @ ^6.21.2
    # ... existing libraries ...
    your-new-library @ ^1.0.0
```

Then rebuild with **⚡ FW Build** button or `pio run`.

## Debugging

### Serial Monitor:
- Click **📺 Monitor** button in VS Code
- Or run: `pio device monitor`
- Baud rate: 115200

### Debug Output:
The firmware includes debug logging. Adjust debug level in `platformio.ini`:
```ini
build_flags = 
    -DCORE_DEBUG_LEVEL=3    # 0=None, 1=Error, 2=Warn, 3=Info, 4=Debug, 5=Verbose
```

## Troubleshooting

### Upload Issues:
1. Check USB cable connection
2. Ensure correct port is detected
3. Press ESP32 reset button during upload if needed
4. Try different USB cable or port

### Build Errors:
1. Clean build: **🧹 Clean** button or `pio run --target clean`
2. Update PlatformIO: `pio update`
3. Check library compatibility in `platformio.ini`

### Library Issues:
1. Clear library cache: `pio lib -g update`
2. Reinstall libraries: Delete `.pio/libdeps/` folder and rebuild

## Advanced Configuration

### Custom Build Environments:
Add new environments to `platformio.ini`:
```ini
[env:debug]
board = esp32doit-devkit-v1
build_flags = 
    -DCORE_DEBUG_LEVEL=5
    -DDEBUG_MODE=1

[env:production]
board = esp32doit-devkit-v1  
build_flags = 
    -DCORE_DEBUG_LEVEL=0
    -Os
```

### OTA Updates:
For over-the-air firmware updates, add OTA configuration:
```ini
upload_protocol = espota
upload_port = 192.168.1.100  # ESP32 IP address
```

## VS Code Integration

The project includes optimized VS Code settings:
- **PlatformIO IDE** extension integration
- **Auto-completion** for ESP32 Arduino framework
- **Intellisense** for all project libraries
- **Task buttons** for common operations

This provides a seamless development experience without leaving VS Code.
