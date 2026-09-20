#!/usr/bin/env python3
"""Capture framebuffer from ESP32-S3-RLCD-4.2 over USB serial and save as PNG.

Usage:
    python3 tools/capture_display.py [--port /dev/cu.usbmodem*] [--output capture.png] [--show]
"""

import argparse
import re
import sys
import time

try:
    import serial
except ImportError:
    print("Error: pySerial not installed. Run: pip3 install --break-system-packages pyserial")
    sys.exit(1)

try:
    from PIL import Image
except ImportError:
    print("Error: Pillow not installed. Run: pip3 install --break-system-packages Pillow")
    sys.exit(1)

ST7305_WIDTH = 400
ST7305_HEIGHT = 300
ROW_BYTES = ST7305_WIDTH // 8  # 50
TOTAL_BYTES = ROW_BYTES * ST7305_HEIGHT  # 15000
BAUD = 115200
TIMEOUT = 30


def probe_ports():
    import glob
    return sorted(glob.glob('/dev/cu.usbmodem*'))


def find_esp32_port():
    ports = probe_ports()
    if not ports:
        print("No ESP32-S3 ports found. Expected /dev/cu.usbmodem*")
        print("Make sure the board is powered on and connected via USB.")
        sys.exit(1)
    if len(ports) == 1:
        return ports[0]
    print(f"Multiple ports found: {ports}")
    for p in ports:
        name = p.split('/')[-1]
        if any(c.isalpha() for c in name[len('cu.usbmodem'):]):
            return p
    return ports[-1]


def capture(port_path, output_path=None, show=False):
    print(f"Connecting to {port_path} at {BAUD} baud...")
    ser = serial.Serial(port_path, BAUD, timeout=2)
    time.sleep(1)
    ser.reset_input_buffer()
    ser.reset_output_buffer()

    print("Sending dump trigger ('d')...")
    ser.write(b'd\n')
    time.sleep(0.5)

    print(f"Waiting for FBHEX marker (up to {TIMEOUT}s)...")
    buf = b''
    deadline = time.time() + TIMEOUT
    in_frame = False
    hex_rows = []
    non_white_count = None

    while time.time() < deadline:
        if ser.in_waiting:
            chunk = ser.read(ser.in_waiting)
        else:
            chunk = ser.read(512)
        if not chunk:
            time.sleep(0.1)
            continue

        buf += chunk

        if not in_frame:
            fbhex_pos = buf.find(b'FBHEX')
            if fbhex_pos >= 0:
                prefix = buf[:fbhex_pos]
                # Show all debug lines before FBHEX
                debug_text = prefix.decode('utf-8', errors='replace')
                for line in debug_text.split('\n'):
                    line = line.strip()
                    if line:
                        print(f"  {line}")
                print("FBHEX marker found! Reading hex data...")
                in_frame = True
                buf = buf[fbhex_pos + 5:]  # skip "FBHEX"
        else:
            end_pos = buf.find(b'FBEND')
            if end_pos >= 0:
                hex_data = buf[:end_pos]
                buf = buf[end_pos + 5:]
                print(f"FBEND marker found. Processing {len(hex_data)} bytes...")

                # Parse hex lines
                all_hex = b''
                for line in hex_data.split(b'\n'):
                    line = line.strip()
                    if line and len(line) == ROW_BYTES * 2:
                        all_hex += line
                    elif line:
                        print(f"  Skipping unexpected line ({len(line)} chars, not {ROW_BYTES * 2})")

                expected_hex_chars = ROW_BYTES * 2 * ST7305_HEIGHT  # 30000
                if len(all_hex) != expected_hex_chars:
                    print(f"WARNING: Got {len(all_hex)} hex chars, expected {expected_hex_chars}")
                    # Try to salvage partial data
                    if len(all_hex) > ROW_BYTES * 2:
                        # Truncate to whole rows
                        rows_got = len(all_hex) // (ROW_BYTES * 2)
                        all_hex = all_hex[:rows_got * ROW_BYTES * 2]
                        print(f"  Using {rows_got} rows of data")

                # Convert hex to bytes
                try:
                    row_major_data = bytes.fromhex(all_hex.decode('ascii'))
                except Exception as e:
                    print(f"Hex decode error: {e}")
                    # Try line by line
                    row_major_data = b''
                    for line in hex_data.split(b'\n'):
                        line = line.strip()
                        if line and len(line) == ROW_BYTES * 2:
                            try:
                                row_major_data += bytes.fromhex(line.decode('ascii'))
                            except Exception:
                                pass

                print(f"Decoded {len(row_major_data)} bytes")

                if len(row_major_data) == 0:
                    print("ERROR: No data decoded!")
                    ser.close()
                    return None

                # Count non-white bytes
                nw = sum(1 for b in row_major_data if b != 0xFF)
                print(f"Non-white bytes in decoded data: {nw} out of {len(row_major_data)}")

                ser.close()

                # Build PBM with header + row-major data
                pbm_header = f"P4\n{ST7305_WIDTH} {ST7305_HEIGHT}\n".encode()
                pbm_data = pbm_header + row_major_data

                # Save as PBM
                pbm_path = 'display_capture.pbm'
                with open(pbm_path, 'wb') as f:
                    f.write(pbm_data)
                print(f"Saved PBM to {pbm_path}")

                # Convert to PNG using PIL
                print("Converting to PNG...")
                img = Image.open(pbm_path)

                if output_path:
                    img.save(output_path)
                    print(f"Saved to {output_path}")
                if show:
                    img.show()

                return img

    ser.close()
    print(f"Timeout: FBHEX marker not found within {TIMEOUT}s")
    print(f"Received {len(buf)} bytes total")
    if buf:
        try:
            text = buf[-500:].decode('utf-8', errors='replace')
            print(f"Last 500 chars received:\n{text}")
        except Exception:
            print(f"Last 200 bytes (hex): {buf[-200:].hex()}")
    return None


def main():
    parser = argparse.ArgumentParser(description='Capture RLCD framebuffer from ESP32-S3')
    parser.add_argument('--port', '-p', help='Serial port (auto-detected if omitted)')
    parser.add_argument('--output', '-o', default='display_capture.png', help='Output PNG file')
    parser.add_argument('--show', '-s', action='store_true', help='Display image after capture')
    args = parser.parse_args()

    port = args.port or find_esp32_port()
    capture(port, args.output, args.show)


if __name__ == '__main__':
    main()
