#pragma once

#include <Arduino.h>
#include <stdint.h>

#define ST7305_WIDTH 400
#define ST7305_HEIGHT 300
#define ST7305_BUFFER_SIZE (ST7305_WIDTH * ST7305_HEIGHT / 8)

bool display_init();
void display_clear();
void display_update();
void display_set_pixel(int x, int y, bool black);
bool display_get_pixel(int x, int y);
void display_draw_char(int x, int y, unsigned char c, bool black);
void display_draw_string(int x, int y, const char* str, bool black);
void display_draw_int(int x, int y, int val, bool black);
void display_draw_float(int x, int y, float val, int decimals, bool black);
int display_draw_progress(int x, int y, int w, int h, int val, int min, int max, bool black);

void display_draw_line(int x0, int y0, int x1, int y1, bool black);
void display_draw_circle(int cx, int cy, int r, bool black);
void display_draw_char_large(int x, int y, unsigned char c, bool black);
void display_draw_string_large(int x, int y, const char* str, bool black);
void display_draw_char_scaled(int x, int y, unsigned char c, int scale, bool black);
void display_draw_string_scaled(int x, int y, const char* str, int scale, bool black);

void display_serial_dump();
