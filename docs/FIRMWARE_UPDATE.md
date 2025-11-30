# Firmware Update Guide

This guide explains how to update the Veetr sailing dashboard firmware to the latest version.

## 🔄 Automatic Update (Recommended)

The easiest way to update your firmware is through the web dashboard's built-in OTA (Over-The-Air) update feature:

1. **Connect to your ESP32** via Bluetooth in the web dashboard
2. **Go to Settings** → **Firmware Update**
3. **Click "Check for Updates"**
4. If a newer version is available, **click "Update Firmware"**
5. **Wait for the update to complete** (do not disconnect during this process)

## 📦 Manual Installation

If the automatic update doesn't work or you prefer manual installation:

### Understanding the Files

When you download a release, you'll see several files:

- **`veetr-X.X.X.bin`** - The firmware binary to flash to your ESP32
- **`veetr-X.X.X.elf`** - Debug symbols file (only needed for development/debugging crashes)
- **`firmware-info.json`** - Build metadata (version, date, size, etc.)

**For normal users**: You only need the `.bin` file.

### Option 1: Using ESPTool (Recommended)

1. **Download the latest firmware** from the [releases page](https://github.com/veetrlabs/veetr/releases)
2. **Install ESPTool** if you haven't already:
   ```bash
   pip install esptool
   ```
3. **Connect your ESP32** to your computer via USB
4. **Flash the firmware**:
   ```bash
   esptool.py --port /dev/ttyUSB0 write_flash 0x10000 veetr-X.X.X.bin
   ```
   
   > **Note**: Replace `/dev/ttyUSB0` with your actual port (on Windows it might be `COM3`, on macOS `/dev/tty.usbserial-*`)

### Option 2: Using PlatformIO

If you have the source code and PlatformIO installed:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/veetrlabs/veetr.git
   cd veetr
   ```
2. **Checkout the desired version**:
   ```bash
   git checkout X.X.X  # Replace with the version tag
   ```
3. **Upload to your ESP32**:
   ```bash
   pio run --target upload
   ```

## 🔍 Verification

After updating, you can verify the firmware version by:

1. **Connecting to the web dashboard**
2. **Going to Settings** → **System Info**
3. **Checking the firmware version** displayed

## ⚠️ Troubleshooting

### Update Failed
- Ensure your ESP32 is properly connected via Bluetooth
- Try refreshing the web dashboard page
- Check that your device has sufficient battery/power
- Try the manual installation method

### Connection Issues
- Make sure Bluetooth is enabled on your device
- **Activate Discovery Mode**: Press and hold the BOOT button (GPIO0) for 1+ seconds
- Verify the built-in LED (GPIO2) turns on to confirm discovery mode is active
- Clear your browser cache and try again
- Check that the ESP32 is powered on and in discovery mode (LED should be on)

### Manual Installation Issues
- Verify the correct port/COM number for your ESP32
- Ensure no other programs are using the serial port
- Try pressing the BOOT button on the ESP32 while connecting

## 📞 Support

If you encounter issues:

1. Check the [Issues page](https://github.com/veetrlabs/veetr/issues) for known problems
2. Create a new issue with details about your problem
3. Include your firmware version, device type, and error messages

---

**Always backup your settings before updating firmware!**
