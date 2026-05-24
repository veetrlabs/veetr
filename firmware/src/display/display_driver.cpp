#include "display_driver.h"
#include "board/pins_esp32s3_rlcd.h"
#include "font_6x8.h"
#include <SPI.h>

static uint8_t *framebuffer = nullptr;

static void send_cmd(uint8_t cmd) {
    digitalWrite(DISPLAY_DC, LOW);
    digitalWrite(DISPLAY_CS, LOW);
    SPI.transfer(cmd);
    digitalWrite(DISPLAY_CS, HIGH);
}

static void send_data(uint8_t data) {
    digitalWrite(DISPLAY_DC, HIGH);
    digitalWrite(DISPLAY_CS, LOW);
    SPI.transfer(data);
    digitalWrite(DISPLAY_CS, HIGH);
}

static void send_cmd_with_data(uint8_t cmd, const uint8_t *data, int len) {
    digitalWrite(DISPLAY_DC, LOW);
    digitalWrite(DISPLAY_CS, LOW);
    SPI.transfer(cmd);
    digitalWrite(DISPLAY_DC, HIGH);
    for (int i = 0; i < len; i++) {
        SPI.transfer(data[i]);
    }
    digitalWrite(DISPLAY_CS, HIGH);
}

static void hardware_reset() {
    digitalWrite(DISPLAY_RST, HIGH);
    delay(50);
    digitalWrite(DISPLAY_RST, LOW);
    delay(20);
    digitalWrite(DISPLAY_RST, HIGH);
    delay(50);
}

struct st7305_cmd {
    uint8_t cmd;
    uint8_t len;
    uint8_t data[10];
};

static const st7305_cmd init_sequence[] = {
    {0xD6, 2, {0x17, 0x02}},
    {0xD1, 1, {0x01}},
    {0xC0, 2, {0x11, 0x04}},
    {0xC1, 4, {0x69, 0x69, 0x69, 0x69}},
    {0xC2, 4, {0x19, 0x19, 0x19, 0x19}},
    {0xC4, 4, {0x4B, 0x4B, 0x4B, 0x4B}},
    {0xC5, 4, {0x19, 0x19, 0x19, 0x19}},
    {0xD8, 2, {0x80, 0xE9}},
    {0xB2, 1, {0x02}},
    {0xB3, 10, {0xE5, 0xF6, 0x05, 0x46, 0x77, 0x77, 0x77, 0x77, 0x76, 0x45}},
    {0xB4, 8, {0x05, 0x46, 0x77, 0x77, 0x77, 0x77, 0x76, 0x45}},
    {0x62, 3, {0x32, 0x03, 0x1F}},
    {0xB7, 1, {0x13}},
    {0xB0, 1, {0x64}},
    {0x11, 0, {}},
    {0xC9, 1, {0x00}},
    {0x36, 1, {0x48}},
    {0x3A, 1, {0x11}},
    {0xB9, 1, {0x20}},
    {0xB8, 1, {0x29}},
    {0x21, 0, {}},
    {0x2A, 2, {0x12, 0x2A}},
    {0x2B, 2, {0x00, 0xC7}},
    {0x35, 1, {0x00}},
    {0xD0, 1, {0xFF}},
    {0x38, 0, {}},
    {0x29, 0, {}},
};

bool display_init() {
    framebuffer = (uint8_t*)malloc(ST7305_BUFFER_SIZE);
    if (!framebuffer) {
        Serial.println("[Display] Failed to allocate framebuffer");
        return false;
    }

    memset(framebuffer, 0xFF, ST7305_BUFFER_SIZE);

    SPI.begin(DISPLAY_CLK, -1, DISPLAY_MOSI, -1);
    SPI.beginTransaction(SPISettings(4000000, MSBFIRST, SPI_MODE0));

    pinMode(DISPLAY_CS, OUTPUT);
    pinMode(DISPLAY_DC, OUTPUT);
    pinMode(DISPLAY_RST, OUTPUT);

    digitalWrite(DISPLAY_CS, HIGH);
    digitalWrite(DISPLAY_DC, HIGH);

    hardware_reset();

    for (size_t i = 0; i < sizeof(init_sequence) / sizeof(init_sequence[0]); i++) {
        const st7305_cmd &c = init_sequence[i];

        if (c.cmd == 0x11) {
            send_cmd(0x11);
            delay(200);
            continue;
        }

        if (c.len == 0) {
            send_cmd(c.cmd);
        } else {
            send_cmd_with_data(c.cmd, c.data, c.len);
        }
    }

    Serial.println("[Display] ST7305 initialized");
    return true;
}

void display_clear() {
    if (framebuffer) {
        memset(framebuffer, 0xFF, ST7305_BUFFER_SIZE);
    }
}

void display_update() {
    if (!framebuffer) return;

    send_cmd(0x38);
    send_cmd(0x29);

    send_cmd(0x2A);
    send_data(0x12);
    send_data(0x2A);

    send_cmd(0x2B);
    send_data(0x00);
    send_data(0xC7);

    digitalWrite(DISPLAY_DC, LOW);
    digitalWrite(DISPLAY_CS, LOW);
    SPI.transfer(0x2C);
    digitalWrite(DISPLAY_DC, HIGH);
    SPI.writeBytes(framebuffer, ST7305_BUFFER_SIZE);
    digitalWrite(DISPLAY_CS, HIGH);
}

void display_set_pixel(int x, int y, bool black) {
    if (!framebuffer) return;
    if (x < 0 || x >= ST7305_WIDTH || y < 0 || y >= ST7305_HEIGHT) return;

    int byte_x = x / 2;
    int inv_y = ST7305_HEIGHT - 1 - y;
    int block_y = inv_y / 4;
    int local_y = inv_y % 4;
    int local_x = x % 2;

    int idx = byte_x * (ST7305_HEIGHT / 4) + block_y;
    int bit = 7 - ((local_y << 1) | local_x);

    if (black) {
        framebuffer[idx] &= ~(1 << bit);
    } else {
        framebuffer[idx] |= (1 << bit);
    }
}

bool display_get_pixel(int x, int y) {
    if (!framebuffer) return false;
    if (x < 0 || x >= ST7305_WIDTH || y < 0 || y >= ST7305_HEIGHT) return false;

    int byte_x = x / 2;
    int inv_y = ST7305_HEIGHT - 1 - y;
    int block_y = inv_y / 4;
    int local_y = inv_y % 4;
    int local_x = x % 2;

    int idx = byte_x * (ST7305_HEIGHT / 4) + block_y;
    int bit = 7 - ((local_y << 1) | local_x);

    return !(framebuffer[idx] & (1 << bit)); // true = black
}

void display_draw_char(int x, int y, unsigned char c, bool black) {
    if (c < FONT_FIRST_CHAR || c > FONT_LAST_CHAR) {
        c = ' ';
    }
    int idx = c - FONT_FIRST_CHAR;
    for (int col = 0; col < FONT_WIDTH; col++) {
        uint8_t byte = font_6x8[idx][col];
        for (int row = 0; row < FONT_HEIGHT; row++) {
            if (byte & (1 << row)) {
                display_set_pixel(x + col, y + row, black);
            }
        }
    }
}

void display_draw_string(int x, int y, const char* str, bool black) {
    int cx = x;
    while (*str) {
        if (*str == '\n') {
            cx = x;
            y += FONT_HEIGHT + 1;
            str++;
            continue;
        }
        display_draw_char(cx, y, (unsigned char)*str, black);
        cx += FONT_WIDTH + 1;
        if (cx + FONT_WIDTH > ST7305_WIDTH) {
            cx = x;
            y += FONT_HEIGHT + 1;
        }
        str++;
    }
}

void display_draw_int(int x, int y, int val, bool black) {
    char buf[16];
    snprintf(buf, sizeof(buf), "%d", val);
    display_draw_string(x, y, buf, black);
}

void display_draw_float(int x, int y, float val, int decimals, bool black) {
    char buf[16];
    snprintf(buf, sizeof(buf), "%.*f", decimals, val);
    display_draw_string(x, y, buf, black);
}

int display_draw_progress(int x, int y, int w, int h, int val, int min, int max, bool black) {
    for (int py = 0; py < h; py++) {
        for (int px = 0; px < w; px++) {
            bool fill = false;
            if (px == 0 || px == w - 1 || py == 0 || py == h - 1) {
                fill = true;
            } else {
                int fill_width = w - 2;
                float ratio = (float)(val - min) / (float)(max - min);
                if (ratio < 0.0f) ratio = 0.0f;
                if (ratio > 1.0f) ratio = 1.0f;
                int filled = (int)(ratio * fill_width);
                if ((px - 1) < filled) fill = true;
            }
            if (fill) {
                display_set_pixel(x + px, y + py, black);
            }
        }
    }
    return w;
}

void display_draw_line(int x0, int y0, int x1, int y1, bool black) {
    int dx = abs(x1 - x0);
    int dy = abs(y1 - y0);
    int sx = x0 < x1 ? 1 : -1;
    int sy = y0 < y1 ? 1 : -1;
    int err = dx - dy;

    while (true) {
        display_set_pixel(x0, y0, black);
        if (x0 == x1 && y0 == y1) break;
        int e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
    }
}

void display_draw_circle(int cx, int cy, int r, bool black) {
    int x = 0;
    int y = r;
    int d = 3 - 2 * r;

    while (x <= y) {
        display_set_pixel(cx + x, cy + y, black);
        display_set_pixel(cx - x, cy + y, black);
        display_set_pixel(cx + x, cy - y, black);
        display_set_pixel(cx - x, cy - y, black);
        display_set_pixel(cx + y, cy + x, black);
        display_set_pixel(cx - y, cy + x, black);
        display_set_pixel(cx + y, cy - x, black);
        display_set_pixel(cx - y, cy - x, black);

        if (d < 0) {
            d += 4 * x + 6;
        } else {
            d += 4 * (x - y) + 10;
            y--;
        }
        x++;
    }
}

void display_draw_char_large(int x, int y, unsigned char c, bool black) {
    if (c < FONT_FIRST_CHAR || c > FONT_LAST_CHAR) return;
    int idx = c - FONT_FIRST_CHAR;
    for (int col = 0; col < FONT_WIDTH; col++) {
        uint8_t byte = font_6x8[idx][col];
        for (int row = 0; row < FONT_HEIGHT; row++) {
            if (byte & (1 << row)) {
                display_set_pixel(x + col * 2,     y + row * 2,     black);
                display_set_pixel(x + col * 2 + 1, y + row * 2,     black);
                display_set_pixel(x + col * 2,     y + row * 2 + 1, black);
                display_set_pixel(x + col * 2 + 1, y + row * 2 + 1, black);
            }
        }
    }
}

void display_draw_string_large(int x, int y, const char* str, bool black) {
    int cx = x;
    while (*str) {
        if (*str == '\n') {
            cx = x;
            y += 17;
            str++;
            continue;
        }
        display_draw_char_large(cx, y, (unsigned char)*str, black);
        cx += 13;
        str++;
    }
}

void display_draw_char_scaled(int x, int y, unsigned char c, int scale, bool black) {
    if (c < FONT_FIRST_CHAR || c > FONT_LAST_CHAR) return;
    int idx = c - FONT_FIRST_CHAR;
    for (int col = 0; col < FONT_WIDTH; col++) {
        uint8_t byte = font_6x8[idx][col];
        for (int row = 0; row < FONT_HEIGHT; row++) {
            if (byte & (1 << row)) {
                for (int sx = 0; sx < scale; sx++) {
                    for (int sy = 0; sy < scale; sy++) {
                        display_set_pixel(x + col * scale + sx, y + row * scale + sy, black);
                    }
                }
            }
        }
    }
}

void display_draw_string_scaled(int x, int y, const char* str, int scale, bool black) {
    int step = FONT_WIDTH * scale + 1;
    int cx = x;
    while (*str) {
        if (*str == '\n') {
            cx = x;
            y += FONT_HEIGHT * scale + 1;
            str++;
            continue;
        }
        display_draw_char_scaled(cx, y, (unsigned char)*str, scale, black);
        cx += step;
        str++;
    }
}

void display_serial_dump() {
    if (!framebuffer) return;
    delay(50);

    // Verify specific known pixels directly from framebuffer
    // Pixel (0,0) is top-left corner of border — should be black (bit=0)
    // Index: byte_x=0/2=0, inv_y=299, block_y=74, idx=0*75+74=74, bit=7-((3<<1)|0)=1
    uint8_t byte_74 = framebuffer[74];
    bool pixel_00_black = !(byte_74 & (1 << 1));
    // Pixel (200,150) is center crosshair — should be black
    // byte_x=200/2=100, inv_y=299-150=149, block_y=149/4=37, idx=100*75+37=7537
    // local_y=149%4=1, local_x=200%2=0, bit=7-((1<<1)|0)=5
    uint8_t byte_7537 = framebuffer[7537];
    bool pixel_200_150_black = !(byte_7537 & (1 << 5));
    // Pixel (123, 45) is in empty area — should be white (bit=1)
    // byte_x=123/2=61, inv_y=299-45=254, block_y=254/4=63, idx=61*75+63=4638
    // local_y=254%4=2, local_x=123%2=1, bit=7-((2<<1)|1)=2
    uint8_t byte_4638 = framebuffer[4638];
    bool pixel_123_45_white = byte_4638 & (1 << 2);

    Serial.printf("[Dump] fb=%p size=%d\n", framebuffer, ST7305_BUFFER_SIZE);
    Serial.printf("[Dump] byte[74]=0x%02X (pixel 0,0 black=%d)\n", byte_74, pixel_00_black);
    Serial.printf("[Dump] byte[7537]=0x%02X (pixel 200,150 black=%d)\n", byte_7537, pixel_200_150_black);
    Serial.printf("[Dump] byte[4638]=0x%02X (pixel 123,45 white=%d)\n", byte_4638, pixel_123_45_white);

    // Count non-white bytes for debug
    int non_white = 0;
    for (int i = 0; i < 256; i++) {
        if (framebuffer[i] != 0xFF) non_white++;
    }
    Serial.printf("[Dump] Non-white in first 256 bytes: %d\n", non_white);

    // Send row-major (PBM-compatible) data as text hex dump
    // Each row = 50 bytes (400 pixels / 8)
    Serial.println("FBHEX");
    const int row_bytes = 50;
    for (int y = 0; y < ST7305_HEIGHT; y++) {
        uint8_t row_buf[50];
        memset(row_buf, 0, 50);
        for (int x = 0; x < ST7305_WIDTH; x++) {
            int byte_x = x / 2;
            int inv_y = ST7305_HEIGHT - 1 - y;
            int block_y = inv_y / 4;
            int local_y = inv_y % 4;
            int local_x = x % 2;
            int idx = byte_x * (ST7305_HEIGHT / 4) + block_y;
            int bit = 7 - ((local_y << 1) | local_x);
            // PBM: 1=black, 0=white — framebuffer bit=0 means black
            if (!(framebuffer[idx] & (1 << bit))) {
                row_buf[x / 8] |= (1 << (7 - (x % 8)));
            }
        }
        // Print row as hex
        for (int i = 0; i < row_bytes; i++) {
            Serial.printf("%02X", row_buf[i]);
        }
        Serial.println();
        delay(1);
    }
    Serial.println("FBEND");
    Serial.flush();
    delay(50);
}
