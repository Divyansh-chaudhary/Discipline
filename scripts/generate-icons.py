#!/usr/bin/env python3
"""Write PWA PNG icons without third-party deps."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "public" / "icons"
CHILI = (196, 69, 26, 255)
CREAM = (255, 246, 232, 255)


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path: Path, pixels: list[list[tuple[int, int, int, int]]]) -> None:
    h = len(pixels)
    w = len(pixels[0])
    raw = b"".join(b"\x00" + b"".join(bytes(px) for px in row) for row in pixels)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


def blend(dst, src):
    sr, sg, sb, sa = src
    if sa == 0:
        return dst
    if sa == 255:
        return src
    dr, dg, db, da = dst
    a = sa / 255
    return (
        int(sr * a + dr * (1 - a)),
        int(sg * a + dg * (1 - a)),
        int(sb * a + db * (1 - a)),
        255,
    )


def draw_icon(size: int, maskable: bool = False) -> list[list[tuple[int, int, int, int]]]:
    pad = int(size * (0.18 if maskable else 0.06))
    pixels = [[(0, 0, 0, 0) for _ in range(size)] for _ in range(size)]
    inner = size - pad * 2
    radius = int(inner * 0.22)

    def in_round_rect(x, y):
        lx, ty = pad, pad
        rx, by = size - pad - 1, size - pad - 1
        if lx + radius <= x <= rx - radius and ty <= y <= by:
            return True
        if ty + radius <= y <= by - radius and lx <= x <= rx:
            return True
        corners = (
            (lx + radius, ty + radius),
            (rx - radius, ty + radius),
            (lx + radius, by - radius),
            (rx - radius, by - radius),
        )
        return any((x - cx) ** 2 + (y - cy) ** 2 <= radius**2 for cx, cy in corners)

    # Background
    for y in range(size):
        for x in range(size):
            if in_round_rect(x, y):
                pixels[y][x] = CHILI

    def stroke_ellipse(cx, cy, rx, ry, width):
        rx2, ry2 = rx * rx, ry * ry
        inner_rx, inner_ry = max(1, rx - width), max(1, ry - width)
        irx2, iry2 = inner_rx * inner_rx, inner_ry * inner_ry
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                if 0 <= x < size and 0 <= y < size:
                    dx, dy = x - cx, y - cy
                    outer = (dx * dx) / rx2 + (dy * dy) / ry2
                    inner = (dx * dx) / irx2 + (dy * dy) / iry2
                    if outer <= 1 and inner >= 1:
                        pixels[y][x] = blend(pixels[y][x], CREAM)

    def stroke_line(x0, y0, x1, y1, width):
        steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) or 1
        r = width / 2
        for i in range(steps + 1):
            t = i / steps
            x = x0 + (x1 - x0) * t
            y = y0 + (y1 - y0) * t
            for yy in range(int(y - r - 1), int(y + r + 2)):
                for xx in range(int(x - r - 1), int(x + r + 2)):
                    if 0 <= xx < size and 0 <= yy < size and (xx - x) ** 2 + (yy - y) ** 2 <= r * r:
                        pixels[yy][xx] = CREAM

    cx = size / 2
    cy = size * 0.56
    plate_rx = inner * 0.32
    plate_ry = inner * 0.20
    stroke = max(2, size * 0.035)
    stroke_ellipse(cx, cy, plate_rx, plate_ry, stroke)
    stroke_ellipse(cx, cy, plate_rx * 0.42, plate_ry * 0.42, stroke * 0.7)
    bar_y = size * 0.34
    stroke_line(size * 0.22, bar_y, size * 0.78, bar_y, stroke)
    stroke_line(size * 0.30, size * 0.28, size * 0.30, size * 0.40, stroke)
    stroke_line(size * 0.70, size * 0.28, size * 0.70, size * 0.40, stroke)
    return pixels


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    write_png(OUT / "icon-192.png", draw_icon(192))
    write_png(OUT / "icon-512.png", draw_icon(512))
    write_png(OUT / "icon-512-maskable.png", draw_icon(512, maskable=True))
    write_png(OUT / "apple-touch-icon.png", draw_icon(180))
    print(f"Wrote icons in {OUT}")


if __name__ == "__main__":
    main()
