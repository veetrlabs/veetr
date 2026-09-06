# Veetr

Veetr provides open source software and hardware for tracking wind speed, direction, speed over ground, GPS tracking, heading, heel and other data in real time during a sail. Great fit for day-sailers or weekend-sailers.

## Features

### 🌊 Real-time Sailing Data
- **SOG** (Speed Over Ground) using GPS
- **AWS** (Apparent Wind Speed) using ultrasonic wind sensor
- **AWA** (Apparent Wind Angle) using ultrasonic wind sensor  
- **TWS** (True Wind Speed) calculated from SOG, AWS, and AWA
- **TWA** (True Wind Angle) calculated from SOG and AWA
- **Heel** (Heeling angle) using 9-axis IMU sensor
- **HDG** (Heading angle to magnetic north) using 9-axis IMU sensor
- **GPS Position** with satellite count and HDOP accuracy

### 📱 Progressive Web App (PWA)
- **Offline Capability** - Works without internet connection after initial load
- **Mobile Installation** - Install as native app on phones and tablets
- **Responsive Design** - Optimized for all screen sizes and orientations
- **Light & Dark Mode** - Perfect for sunny days and night passages
- **Always Up-to-Date** - Automatic updates when internet is available

### 🔄 Firmware & Connectivity
- **OTA Updates** - Over-the-air firmware updates through the web app
- **Multi-Device Support** - Up to 4 devices can connect simultaneously
- **Bluetooth Security** - Discovery mode only when button is pressed (5-minute window)
- **Real-time Data** - 1-second refresh rate for live sailing data
- **RSSI Monitoring** - Signal strength indicator with connection quality

### 🏁 Racing Features
- **Regatta Starting Line** - Pin 2 GPS points and track distance to start line
- **Visual Compass** - Wind direction and heading display with smooth animations
- **Satellite Status** - GPS quality monitoring with visual indicators
- **Connection Management** - Robust BLE connection with automatic reconnection

## Why Veetr?

### 💰 Cost-Effective
- **Open source software** - Free firmware and app to use, install, host yourself and/or modify
- **Open hardware** - PCB Gerber files included for custom manufacturing ([download files](./pcb/))
- **Modular design** - Use standard sensors from AliExpress with pin headers ([full parts list](./docs/HARDWARE.md))
- **3D printed case** - Print yourself or with local maker community
- **Budget-friendly** - Complete electronic components for ~$250 (2025 pricing)

### ⚡ Performance & Reliability
- **Modular architecture** - Easy to repair, upgrade, or replace individual sensors
- **Low power consumption** - 10Ah powerbank provides ~24 hours at 1-second refresh rate
- **No moving parts** - Ultrasonic wind sensor for precision and durability
- **Lightweight** - Wind sensor: 66x64mm, 89 grams
- **Quality sensors** - High-precision components without compromise

### 🔒 Security & Independence
- **Physical Security** - Bluetooth discoverable only with button press (5-minute window)
- **Privacy-First** - All data stays on your device, no cloud dependency
- **USB-C Power** - Works with any standard powerbank or USB-C charger

## Technology Stack

### 🌐 Web Dashboard:
- **React 18** + TypeScript + Vite for modern development
- **Progressive Web App (PWA)** with Service Worker for offline capability
- **Web Bluetooth API** for direct BLE communication
- **Lucide React Icons** for consistent, scalable vector graphics
- **CSS Custom Properties** for theming and responsive design
- **Responsive Layout** optimized for mobile, tablet, and desktop

### 🔧 ESP32 Firmware:
- **Arduino Framework** via PlatformIO for robust development
- **NimBLE Stack** for Bluetooth Low Energy with multi-connection support
- **Multi-Sensor Integration** ([hardware details](./docs/HARDWARE.md)):
  - GPS module (UART) for position and speed
  - BNO080 IMU (I2C) for heading and heel
  - Ultrasonic wind sensor (RS485) for wind speed/direction
- **RSSI Filtering** with moving average for stable signal strength
- **Discovery Mode Security** with button-activated pairing
- **OTA Update Support** for seamless firmware upgrades

### 📡 Communication Protocol:
- **BLE GATT Services** for sensor data streaming
- **JSON Data Format** for structured sensor readings
- **Real-time Updates** at 1Hz refresh rate
- **Multi-device Broadcasting** supporting up to 4 concurrent connections

## 🔧 Hardware Design

![Veetr PCB Assembly](./pcb/Veetr-in-box.jpg)

Veetr uses a **modular breakout board design** with standard off-the-shelf sensors for maximum flexibility and repairability.

**📋 Full Details**: [Hardware Guide](./docs/HARDWARE.md) | **🔧 PCB Files**: [Manufacturing Files](./pcb/)

## 🚀 Quick Start

### For Sailors (Using the App):
1. **Visit** [app.veetr.org](https://app.veetr.org) on your mobile device
2. **Install** the app (tap "Add to Home Screen" or "Install" prompt)
3. **Press** the physical button on your Veetr device to enable discovery mode or restart the device
4. **Connect** via the Bluetooth button in the app
5. **Sail** with real-time data - works offline once connected!

### For Developers:
```bash
# Clone and setup web app
git clone https://github.com/veetrlabs/veetr.git
cd veetr/app
npm install
npm run dev

# Setup firmware development
cd ../firmware
pio run --target upload
```

## Documentation

For detailed information, see the [docs/](./docs/) directory:

- **[Setup Guide](./docs/SETUP.md)** - Step-by-step user setup for sailors
- **[Software Overview](./docs/SOFTWARE.md)** - How the ESP32 firmware and PWA work together
- **[Firmware](./docs/FIRMWARE.md)** - Sensor acquisition, calculations, BLE, settings, and updates
- **[Progressive Web App](./docs/PWA.md)** - Dashboard, local history, offline behavior, and browser support
- **[Development Guide](./docs/DEVELOPMENT.md)** - Developer workflow and contribution guide
- **[Hardware Guide](./docs/HARDWARE.md)** - ESP32 wiring and sensor specifications
- **[PCB Files](./pcb/README.md)** - Gerber files and PCB manufacturing information ([download Gerbers](./pcb/gerbers/))
- **[Compliance & Certifications](./docs/COMPLIANCE.md)** - FCC, CE, IC regulatory compliance
- **[Firmware Update Guide](./docs/FIRMWARE_UPDATE.md)** - How to update ESP32 firmware
- **[PlatformIO Guide](./docs/PLATFORMIO.md)** - Firmware development details
- **[Storage Architecture](./docs/STORAGE.md)** - Data storage and persistence
- **[Version Management](./docs/VERSION_MANAGEMENT.md)** - Release and versioning workflow

## License

MIT License - see [LICENSE](./LICENSE) for details.
