# Repository custom instructions for GitHub Copilot

## Important Note
**ALWAYS READ THE README.MD FILE FIRST** - It contains comprehensive setup instructions, documentation, and usage guidelines for this project. Use it as your primary reference when working on this project.

## About this project
This is a **full-stack marine IoT project** combining ESP32 firmware development (PlatformIO) with a modern Progressive Web App (PWA) dashboard.

**Project Structure:**
- `firmware/` - ESP32 embedded system (PlatformIO/Arduino framework)
- `web/` - React TypeScript PWA dashboard (Vite build system)
- `docs/` - Comprehensive technical documentation

The project provides sailors on small racing vessels with real-time performance data through a seamless hardware-software integration:

**Data Flow:** ESP32 sensors → BLE → PWA Dashboard → Real-time marine visualization

**Marine Data Points:**
- Speed Over Ground (SOG) via GPS with intelligent noise filtering
- Apparent Wind Speed (AWS) and Direction (AWD) via ultrasonic sensor
- Vessel heel/tilt angle and magnetic heading via 9-axis IMU
- GPS position and satellite status
- BLE connection quality (RSSI)

**Architecture:** ESP32 BLE server using NimBLE-Arduino library, serving standardized JSON marine data to a React TypeScript PWA with Web Bluetooth API integration.

**Key Features:**
- **Full-Stack Integration:** Seamless ESP32 firmware + React PWA development
- **Bluetooth Low Energy (BLE):** NimBLE-Arduino server with Web Bluetooth API client
- **Robust Sensor Handling:** Individual sensors can fail without affecting system operation
- **Standardized Marine JSON API:** Proper maritime terminology (SOG, AWS, AWD, etc.)
- **Real-time Data Streaming:** 1Hz reliable transmission with modern web visualization
- **Power Efficient Design:** Optimized for extended battery operation in marine environments
- **Modern Web Technologies:** React 18 + TypeScript + Vite for fast development and deployment
- **Progressive Web App:** Installable, offline-capable marine dashboard
- **Responsive Design:** Optimized for tablets and smartphones in marine conditions

## Technical Stack

### Firmware (ESP32)
- **Platform:** PlatformIO with Arduino framework
- **Language:** C++11/14 with modern embedded practices
- **Hardware:** ESP32 DevKitC WROOM-32U with external antenna
- **Communication:** NimBLE-Arduino for efficient BLE server implementation
- **Sensors:** BNO080 9-axis IMU, RS485 wind sensor, GPS (future)

### Web Application (PWA)
- **Framework:** React 18 with TypeScript
- **Build System:** Vite for fast development and optimized builds
- **Styling:** Modern CSS with CSS Grid and Flexbox
- **PWA Features:** Service worker, manifest, installable
- **Communication:** Web Bluetooth API for direct ESP32 connection
- **State Management:** React Context API for theme and BLE state

## Hardware Dependencies

**For complete hardware specifications, see [docs/HARDWARE.md](docs/HARDWARE.md)**

### Quick Reference
- **Main Controller:** ESP32 DevKitC WROOM-32U Development Board
- **Sensors:** BNO080 9-axis IMU (tilt, heading, acceleration), RS485 Wind Sensor, GPS (future)
- **Communication:** RS485 to TTL converter for wind sensor
- **Power:** 5V USB or external, ~200mA typical consumption

### Pin Assignments (Current Project)
| Component | ESP32 Pin | Function |
| --------- | --------- | -------- |
| BNO080 IMU Sensor | IO21 (SDA) | I2C Data |
| BNO080 IMU Sensor | IO22 (SCL) | I2C Clock |
| RS485 Wind Sensor | IO32 (RX2) | Serial RX from RS485 converter |
| RS485 Wind Sensor | IO33 (TX2) | Serial TX to RS485 converter |
| RS485 Control | IO14 | DE/RE pin for half-duplex control |
| GPS Module (future) | IO16 (RX) | Serial RX for GPS communication |
| GPS Module (future) | IO17 (TX) | Serial TX for GPS communication |
| Anchor Light | IO25 | PWM LED control (masthead) |
| Discovery Button | IO0 | Built-in BOOT button |
| Status LED | IO2 | Built-in LED |

## Software Architecture Reference

The software architecture has been migrated from WiFi Access Point to BLE connectivity:

### Current Architecture (BLE-based)
- **ESP32:** BLE server using NimBLE-Arduino library
- **Connectivity:** Bluetooth Low Energy with multi-client support
- **Data Format:** Standardized JSON with marine terminology
- **Web App:** Externally hosted (GitHub Pages/Netlify) over HTTPS
- **Client Connection:** Web Bluetooth API for direct ESP32 connection

### Communication Flow
1. **GPS Module** → UART (GPIO 16/17) → ESP32 → JSON over BLE
2. **BNO080 IMU Sensor** → I2C (GPIO 21/22) → ESP32 → JSON over BLE
3. **Wind Sensor** → RS485 → RS485 Transceiver → UART (GPIO 25/26) → ESP32 → JSON over BLE

### BLE Service Configuration
- **Service UUID:** 12345678-1234-1234-1234-123456789abc
- **Characteristic UUID:** 87654321-4321-4321-4321-cba987654321
- **Data Rate:** 1Hz (1000ms intervals)
- **Data Format:** JSON string with standardized marine fields

### JSON API Fields
- **Always Present:** SOG, COG, lat, lon, satellites, hdop, rssi
- **Conditional:** AWS, AWD (wind sensor), heel (BNO080 IMU sensor)
- **Marine Standards:** Uses proper marine terminology and units

### Error Handling
- **Sensor Failures:** Individual sensors can fail without affecting system
- **Missing Sensors:** Detected at startup, graceful degradation
- **I2C/RS485 Errors:** Timeouts prevent blocking, warnings logged periodically
- **BLE Reliability:** Data transmission continues regardless of sensor status

### Power Management
- **BLE Efficiency:** ~50% less power than WiFi approach
- **NimBLE Library:** Optimized for low power consumption
- **Sensor Management:** Failed sensors don't consume retry power

## Development Workflows

### Firmware Development (firmware/)
- **Build:** Use VS Code PlatformIO tasks or `pio run` in root directory
- **Upload:** Use task buttons or `pio run --target upload`
- **Monitor:** Built-in serial monitor for debugging
- **Structure:** Standard PlatformIO layout with src/, lib/, include/ directories

### Web Development (web/)
- **Development:** `npm run dev` for Vite dev server with hot reload
- **Build:** `npm run build` for production deployment
- **Preview:** `npm run preview` to test production build locally
- **Structure:** Modern React project with components/, hooks/, context/, utils/

### Unified Development
- **Root Tasks:** VS Code tasks available for both firmware and web builds
- **Documentation:** Centralized in docs/ with markdown files
- **Version Control:** Single repository with clear separation of concerns
- **Testing:** BLE communication testing between firmware and web components

## Coding Preferences

### Firmware (C++)
- Prefer C++ style with modern C++11/14 features
- Follow PlatformIO project structure conventions
- Use descriptive variable names and clear commenting
- Implement robust error handling for sensor failures
- Use appropriate low-power techniques for battery efficiency
- Prefer non-blocking code to maintain system responsiveness
- **BLE Focus:** Use NimBLE-Arduino for efficient BLE communication
- **Marine Standards:** Use proper marine terminology in JSON API (SOG, AWS, AWD, etc.)
- **Sensor Robustness:** Handle missing/failed sensors gracefully

### Web Application (TypeScript/React)
- Follow React 18 best practices with functional components and hooks
- Use TypeScript for type safety and better developer experience
- Implement proper error boundaries and loading states
- Use CSS custom properties for theming (light/dark mode)
- Follow PWA best practices for offline functionality
- **Web Bluetooth:** Handle connection states and errors gracefully
- **Marine UX:** Design for readability in bright sunlight conditions
- **Responsive Design:** Optimize for marine tablet/smartphone usage

### CSS and Styling Guidelines
- **Modern CSS:** Prefer `clamp()`, `min()`, `max()` over media queries for sizing/spacing
- **Responsive Grids:** Use `repeat(auto-fit, minmax(min(150px, 100%), 1fr))`
- **Media Queries:** Only for layout shifts, orientation, or feature detection
- **Consistency:** CSS custom properties for theming, minimum 44px touch targets
- **Details:** See `.github/copilot/web-designer-agent.md` for comprehensive guidelines

## Problem-Solving Approach

### Firmware Development
When generating embedded code for this project, consider:
- Power efficiency for battery-operated marine devices
- Memory constraints of ESP32 and real-time performance requirements
- Error handling for sensor failures without blocking main loop
- Environmental challenges of marine applications (vibration, moisture, temperature)
- BLE connectivity optimization for low-latency, multi-client communication
- Marine environment considerations (power consumption, reliability)

### Web Development
When working on the PWA, consider:
- Marine UX requirements (sunlight readability, touch-friendly interfaces)
- Web Bluetooth API limitations and browser compatibility
- Offline functionality and data persistence
- Responsive design for various screen sizes in marine environments
- Performance optimization for lower-end mobile devices
- Progressive enhancement for different device capabilities

### Full-Stack Integration
- Maintain consistent marine terminology between firmware JSON API and web UI
- Handle BLE connection states gracefully on both ends
- Ensure data validation and error handling across the entire stack
- Document API changes that affect both firmware and web components
- Consider power management implications of BLE communication patterns
- **Prefer VS Code tasks over CLI commands** for unified development workflow
- **Update documentation** when making significant changes to maintain accuracy

## Project Context

This is a **professional marine IoT solution** that requires careful consideration of:

**Hardware Constraints:**
- ESP32 memory limitations and real-time performance requirements
- Battery power efficiency for extended operation in marine environments
- Sensor reliability and environmental challenges of marine conditions

**Software Architecture:**
- **Firmware:** NimBLE-Arduino BLE server with standardized marine JSON API
- **Web App:** React TypeScript PWA with Web Bluetooth integration
- **Communication:** Standardized JSON with conditional field presence based on sensor availability
- **Error Resilience:** Robust error handling without system interruption on both firmware and web sides
- **Multi-Client Support:** Simultaneous BLE connections to multiple devices/browsers

**Current Status:**
- **Unified Repository:** Both firmware and web app in single repository with clear separation
- **Modern Development Stack:** PlatformIO + Vite for fast development cycles
- **Standardized Marine API:** Proper maritime terminology and units throughout
- **Production Ready:** Robust error handling, power optimization, and comprehensive documentation
- **Cross-Platform PWA:** Works on desktop, tablet, and mobile devices

**Key Libraries & Dependencies:**

*Firmware:*
- NimBLE-Arduino for BLE communication
- ArduinoJson for JSON serialization
- SparkFun BNO080 library for 9-axis IMU sensor
- TinyGPS++ for GPS parsing (future integration)

*Web Application:*
- React 18 with TypeScript for UI framework
- Vite for build tooling and development server
- Web Bluetooth API for ESP32 communication
- CSS custom properties for theming system

Refer to the README.md file for comprehensive implementation details, setup instructions, and development workflows for both firmware and web components.
