---
name: esp32s3-rlcd
description: Board-specific knowledge for the Waveshare ESP32-S3-RLCD-4.2 — upload workflow, pixel formula, pin map, init sequence, and display driver architecture
---

# ESP32-S3-RLCD-4.2 Board Skill

## Board Identity
- **Board:** Waveshare ESP32-S3-RLCD-4.2
- **Module:** ESP32-S3-WROOM-1-N16R8 (16MB flash, 8MB Octal PSRAM)
- **Display:** 4.2" ST7305 RLCD, 400×300 monochrome (black/white only)
- **PlatformIO board config:** `esp32-s3-rlcd-n16r8` (defined in `boards/esp32-s3-rlcd-n16r8.json`)
- **PlatformIO env:** `esp32s3-rlcd` (in `platformio.ini`)

## Critical Hardware Facts

### No RESET Button
- This board has **no dedicated RESET button**
- The physical **PWR button** controls power on/off (short-press toggles)
- **Upload workflow:**
  1. Hold **BOOT button** (GPIO0, active LOW)
  2. Short-press **PWR button** (this powers the board on in download mode)
  3. Release BOOT button
  4. Flash via `platformio run -e esp32s3-rlcd -t upload`
  5. Chip stays in bootloader after flash (no auto-reset)
  6. **Power-cycle:** short-press PWR off, then short-press PWR on to boot
- **No DTR/RTS auto-reset** — native USB-serial-JTAG bootloader doesn't expose these signals
- `platformio.ini` uses `--before=no_reset` and `--after=no_reset`

### Native USB Port
- Bootloader mode: `/dev/cu.usbmodem101`
- App mode: `/dev/cu.usbmodem90706933F68C1`
- Upload port configured in `platformio.ini` as `/dev/cu.usbmodem101`
- Override with: `platformio run -e esp32s3-rlcd -t upload --upload-port /dev/cu.<other>`
- CH343 UART driver not needed — native USB works

### PSRAM is Mandatory
- Octal PSRAM must be enabled — display framebuffer (15000 bytes) and LUTs depend on it
- Board config enables PSRAM at 80MHz

## Display Driver Architecture

### Files
- `firmware/src/display/display_driver.h` — interface: `display_init()`, `display_clear()`, `display_update()`, `display_set_pixel()`, drawing primitives, font rendering
- `firmware/src/display/display_driver.cpp` — implementation (SPI, init sequence, pixel formula, primitives)
- `firmware/src/display/display_ui.cpp` — UI composition: test patterns, sensor readout layout
- `firmware/src/display/display_ui.h` — `display_ui_init()`, `display_ui_update(const SensorData&)`
- `firmware/src/display/font_6x8.h` — 6×8 bitmap font, ASCII 0x20–0x7E

### SPI Configuration
- **Speed:** 4MHz (`SPISettings(4000000, MSBFIRST, SPI_MODE0)`)
- **Pins:** CLK=11, MOSI=12, CS=40, DC=5, RST=41
- **SPI init:** `SPI.begin(11, -1, 12, -1)` (no MISO)

### Pixel Addressing (CRITICAL — matches ESPHome reference)
The ST7305 packs pixels 2-wide × 4-tall per byte. Bit 7 is the upper-left of the 2×4 block.

```
int byte_x = x / 2;
int inv_y = 299 - y;                          // Y inversion
int block_y = inv_y / 4;
int local_y = inv_y % 4;
int local_x = x % 2;
int idx = byte_x * 75 + block_y;              // 75 = 300/4
int bit = 7 - ((local_y << 1) | local_x);
```

- `display_set_pixel(x, y, true)` → pixel black (clears bit to 0)
- `display_set_pixel(x, y, false)` → pixel white (sets bit to 1)
- `display_clear()` sets all bytes to 0xFF (all white)

### MADCTL (0x36) = 0x48
- MX=1 (column mirror), DO=1 (row order)
- Column address range: 0x12–0x2A (offset by 18, 25 columns = 400 pixels / 16)
- Page address range: 0x00–0xC7 (200 rows)
- Y inversion in pixel formula compensates for DO=1

### Init Sequence
Sent once in `display_init()` (from `firmware/src/display/display_driver.cpp`):
```
0xD6 [0x17, 0x02]   // unknown
0xD1 [0x01]          // unknown
0xC0 [0x11, 0x04]   // booster
0xC1 [0x69×4]        // VOP
0xC2 [0x19×4]        // VBIAS
0xC4 [0x4B×4]        // VBIAS?
0xC5 [0x19×4]        // VBIAS?
0xD8 [0x80, 0xE9]   // unknown
0xB2 [0x02]          // frame rate
0xB3 [10 bytes]      // waveform LUT
0xB4 [8 bytes]       // waveform LUT
0x62 [0x32, 0x03, 0x1F]  // unknown
0xB7 [0x13]          // gate setting
0xB0 [0x64]          // source setting
0x11 + delay(200)    // sleep out
0xC9 [0x00]          // unknown
0x36 [0x48]          // MADCTL
0x3A [0x11]          // pixel format (3-bit per pixel? ST7305 uses 1bpp)
0xB9 [0x20]          // unknown
0xB8 [0x29]          // unknown
0x21                 // display inversion on
0x2A [0x12, 0x2A]   // column address
0x2B [0x00, 0xC7]   // page address
0x35 [0x00]          // tearing off
0xD0 [0xFF]          // unknown
0x38                 // high power mode
0x29                 // display on
```

### Frame Update Sequence
Before each frame write in `display_update()`:
1. `0x38` (High Power Mode)
2. `0x29` (Display On)
3. Column address: `0x2A`, data `0x12`, `0x2A`
4. Page address: `0x2B`, data `0x00`, `0xC7`
5. RAM write: `0x2C` followed by all 15000 framebuffer bytes via `SPI.transfer()`

### Framebuffer
- Size: `400 × 300 / 8 = 15000 bytes`
- Allocated in `display_init()` via `malloc(ST7305_BUFFER_SIZE)`
- Stored as static `uint8_t*` in `display_driver.cpp`

## Drawing Primitives
| Function | Description |
|---|---|
| `display_set_pixel(x, y, black)` | Set individual pixel (true=black, false=white) |
| `display_draw_line(x0, y0, x1, y1, black)` | Bresenham line |
| `display_draw_circle(cx, cy, r, black)` | Midpoint circle |
| `display_draw_char(x, y, c, black)` | 6×8 character |
| `display_draw_string(x, y, str, black)` | 6×8 string, auto-wraps |
| `display_draw_char_large(x, y, c, black)` | 12×16 character (2× scale) |
| `display_draw_string_large(x, y, str, black)` | 12×16 string |
| `display_draw_char_scaled(x, y, c, scale, black)` | Arbitrary scale character |
| `display_draw_string_scaled(x, y, str, scale, black)` | Arbitrary scale string |
| `display_draw_int(x, y, val, black)` | 6×8 integer |
| `display_draw_float(x, y, val, decimals, black)` | 6×8 float |
| `display_draw_progress(x, y, w, h, val, min, max, black)` | Progress bar |

### Font Sizes
- **Base font:** 6×8 pixels
- **Large (2×):** 12×16, char step = 13px, line step = 17px
- **Scaled (3×):** 18×24, char step = 19px, line step = 25px

## Upload Commands
```bash
# Build RLCD firmware
pio run -e esp32s3-rlcd

# Upload (requires board in download mode: hold BOOT + short-press PWR)
pio run -e esp32s3-rlcd -t upload

# Monitor serial
pio run -e esp32s3-rlcd -t monitor
# or
screen /dev/cu.usbmodem90706933F68C1 115200

# Monitor with custom port
platformio device monitor --port /dev/cu.usbmodem90706933F68C1 -b 115200
```

### Upload Speed
- Config: `upload_speed = 921600` (works reliably with native USB)
- If `esptool` fails, try lower speed (460800) via `--upload-speed` flag

## Key Pin Assignments
| GPIO | Function | Notes |
|---|---|---|
| GPIO0 | BOOT Button | Active LOW, used for download mode + custom input |
| GPIO5 | RLCD DC | Data/Command select |
| GPIO11 | SPI CLK | Display serial clock |
| GPIO12 | SPI MOSI | Display serial data |
| GPIO13 | I2C SDA | Shared bus (SHTC3, PCF85063, BNO080) |
| GPIO14 | I2C SCL | Shared bus |
| GPIO18 | KEY Button | Custom user button, active LOW with pull-up |
| GPIO40 | RLCD CS | SPI chip select |
| GPIO41 | RLCD RST | Display hardware reset |
| GPIO47 | Anchor Light | LED output |
| GPIO48 | Discovery LED | BLE discovery indicator |

## Verified Working (as of May 2026)
- Full-screen black pattern renders correctly — pixel formula and SPI confirmed
- Diagnostic test pattern renders border, crosshair, corner labels, sensor readouts
- Font rendering works at 1×, 2×, and 3× scales
- Display init sequence complete and functional

## Common Pitfalls
- Forgetting to power-cycle after upload (chip stays in bootloader)
- Holding BOOT too late (must hold before and during PWR press)
- PWR button is a power toggle, not a reset — one short-press to power off, another to power on
- Don't apply pressure to RLCD panel (glass-backed, no bezel)
- Use only M2.5×6 screws for mounting

## Upload Checklist
- [ ] Board is powered OFF
- [ ] Hold BOOT button
- [ ] Short-press PWR button (board powers ON in download mode)
- [ ] Release BOOT button
- [ ] Run `pio run -e esp32s3-rlcd -t upload`
- [ ] Wait for `HARD RESETTING...` (harmless, bootloader ignores it)
- [ ] Short-press PWR OFF
- [ ] Short-press PWR ON to boot new firmware
