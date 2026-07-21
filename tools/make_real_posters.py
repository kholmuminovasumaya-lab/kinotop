#!/usr/bin/env python3
"""Generate cinematic JPEG posters + backgrounds (offline, unique per movie)."""
from __future__ import annotations

import math
import os
import random
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POSTERS = ROOT / "assets" / "images" / "posters"
BGS = ROOT / "assets" / "images" / "backgrounds"

# Per-movie look: palette + scene motif (no numbers as the main art)
MOVIES = {
    2: {"title": "НАЧАЛО", "year": "2010", "mood": "dream", "c1": (12, 24, 58), "c2": (180, 140, 90), "c3": (40, 90, 160)},
    3: {"title": "ИНТЕРСТЕЛЛАР", "year": "2014", "mood": "space", "c1": (5, 8, 22), "c2": (220, 180, 120), "c3": (80, 120, 200)},
    4: {"title": "ДЖОКЕР", "year": "2019", "mood": "neon", "c1": (20, 8, 12), "c2": (220, 40, 50), "c3": (40, 160, 90)},
    5: {"title": "ПАРАЗИТЫ", "year": "2019", "mood": "house", "c1": (30, 40, 35), "c2": (190, 170, 120), "c3": (90, 110, 70)},
    6: {"title": "ДЮНА", "year": "2021", "mood": "desert", "c1": (40, 28, 12), "c2": (210, 170, 90), "c3": (160, 100, 40)},
    7: {"title": "ОДИН ДОМА", "year": "1990", "mood": "xmas", "c1": (20, 35, 55), "c2": (200, 40, 40), "c3": (40, 120, 70)},
    8: {"title": "СИЯНИЕ", "year": "1980", "mood": "hotel", "c1": (25, 20, 30), "c2": (180, 40, 40), "c3": (200, 190, 180)},
    9: {"title": "МАТРИЦА", "year": "1999", "mood": "matrix", "c1": (0, 10, 5), "c2": (20, 220, 80), "c3": (5, 40, 20)},
    10: {"title": "КОРОЛЬ ЛЕВ", "year": "1994", "mood": "savanna", "c1": (50, 30, 10), "c2": (240, 180, 60), "c3": (180, 90, 30)},
    11: {"title": "ОЧЕНЬ СТРАННЫЕ ДЕЛА", "year": "2016", "mood": "80s", "c1": (15, 5, 30), "c2": (255, 60, 120), "c3": (40, 200, 220)},
    12: {"title": "ВО ВСЕ ТЯЖКИЕ", "year": "2008", "mood": "desert", "c1": (35, 45, 55), "c2": (200, 160, 70), "c3": (90, 120, 60)},
    13: {"title": "МСТИТЕЛИ: ФИНАЛ", "year": "2019", "mood": "epic", "c1": (10, 15, 40), "c2": (220, 60, 60), "c3": (80, 140, 220)},
    14: {"title": "1+1", "year": "2011", "mood": "paris", "c1": (40, 45, 70), "c2": (220, 190, 140), "c3": (100, 130, 180)},
    15: {"title": "ЗВЁЗДНЫЕ ВОЙНЫ", "year": "1980", "mood": "space", "c1": (5, 5, 20), "c2": (255, 210, 80), "c3": (100, 140, 255)},
    16: {"title": "ОНО", "year": "2017", "mood": "horror", "c1": (25, 10, 15), "c2": (200, 30, 40), "c3": (80, 20, 30)},
    17: {"title": "ТИТАНИК", "year": "1997", "mood": "ocean", "c1": (10, 25, 50), "c2": (220, 180, 140), "c3": (60, 120, 180)},
    18: {"title": "ИГРА ПРЕСТОЛОВ", "year": "2011", "mood": "epic", "c1": (20, 18, 28), "c2": (180, 150, 90), "c3": (90, 70, 50)},
}


def clamp(v: int) -> int:
    return 0 if v < 0 else 255 if v > 255 else v


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def mix(c1, c2, t):
    return tuple(int(lerp(c1[i], c2[i], t)) for i in range(3))


def noise2(x: int, y: int, seed: int) -> float:
    n = (x * 374761393 + y * 668265263 + seed * 982451653) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177
    return ((n ^ (n >> 16)) & 0xFFFF) / 65535.0


def fbm(x: float, y: float, seed: int) -> float:
    v = 0.0
    a = 0.5
    f = 1.0
    for i in range(4):
        v += a * noise2(int(x * f), int(y * f), seed + i * 17)
        a *= 0.5
        f *= 2.1
    return v


def make_pixels(w: int, h: int, meta: dict, seed: int, wide: bool = False):
    c1, c2, c3 = meta["c1"], meta["c2"], meta["c3"]
    mood = meta["mood"]
    pixels = bytearray(w * h * 3)

    for y in range(h):
        ty = y / (h - 1)
        for x in range(w):
            tx = x / (w - 1)
            n = fbm(x * 0.02, y * 0.02, seed)
            n2 = fbm(x * 0.05 + 40, y * 0.03, seed + 9)

            # base atmospheric gradient
            base = mix(c1, c2, ty * 0.55 + n * 0.25)
            if mood in ("space", "matrix", "horror"):
                base = mix(c1, c3, abs(math.sin(tx * 3.1 + n)) * 0.4 + ty * 0.3)
            elif mood == "desert" or mood == "savanna":
                horizon = 0.55
                if ty < horizon:
                    sky_t = ty / horizon
                    base = mix((25, 50, 90), c2, sky_t * 0.7 + n * 0.15)
                else:
                    sand_t = (ty - horizon) / (1 - horizon)
                    base = mix(c2, c1, sand_t * 0.8 + n2 * 0.2)
            elif mood == "ocean":
                if ty < 0.45:
                    base = mix((180, 200, 230), (40, 80, 140), ty / 0.45 + n * 0.1)
                else:
                    base = mix((20, 60, 110), (5, 20, 40), (ty - 0.45) / 0.55 + n2 * 0.15)
            elif mood == "neon" or mood == "80s":
                base = mix(c1, c3, n * 0.5 + abs(tx - 0.5) * 0.4)
                glow = math.exp(-((tx - 0.5) ** 2) * 8) * math.exp(-((ty - 0.35) ** 2) * 6)
                base = mix(base, c2, glow * 0.55)
            elif mood == "dream":
                fold = abs(math.sin(tx * math.pi + n2 * 2)) * (1 - ty * 0.3)
                base = mix(c1, c2, fold * 0.6 + ty * 0.2)
                base = mix(base, c3, n * 0.25)
            elif mood == "xmas":
                base = mix(c1, (15, 25, 45), ty)
                if n2 > 0.72 and ty < 0.7:
                    base = mix(base, (240, 245, 255), 0.7)  # snow flecks
            elif mood == "hotel":
                base = mix(c3, c1, ty * 0.8 + n * 0.1)
                # corridor perspective lines
                cx = 0.5
                corridor = abs(tx - cx) < (0.08 + ty * 0.35)
                if corridor:
                    base = mix(base, c2, 0.15 + n * 0.1)
            elif mood == "house":
                base = mix((60, 80, 70), c2, ty * 0.5 + n * 0.2)
            elif mood == "paris":
                base = mix((90, 110, 150), c2, ty * 0.6)
            elif mood == "epic":
                base = mix(c1, c2, ty * 0.4 + n * 0.2)
                base = mix(base, c3, abs(tx - 0.5) * 0.3)

            # soft light blob (lens / sun)
            lx, ly = 0.3 + (seed % 7) * 0.08, 0.25 + (seed % 5) * 0.05
            dist = math.hypot(tx - lx, ty - ly)
            blob = max(0.0, 1.0 - dist * 2.2)
            base = mix(base, (255, 240, 210), blob * blob * 0.35)

            # film grain
            g = (noise2(x, y, seed + 99) - 0.5) * 28
            r = clamp(int(base[0] + g))
            gch = clamp(int(base[1] + g * 0.9))
            b = clamp(int(base[2] + g * 1.1))

            # vignette
            vx = (tx - 0.5) * 1.7
            vy = (ty - 0.5) * 1.5
            vig = 1.0 - min(1.0, (vx * vx + vy * vy) * 0.85)
            r = clamp(int(r * (0.35 + 0.65 * vig)))
            gch = clamp(int(gch * (0.35 + 0.65 * vig)))
            b = clamp(int(b * (0.35 + 0.65 * vig)))

            i = (y * w + x) * 3
            pixels[i] = r
            pixels[i + 1] = gch
            pixels[i + 2] = b

    # draw motif shapes on top
    draw_motif(pixels, w, h, mood, c2, c3, seed)
    draw_title_bar(pixels, w, h, meta, wide)
    return pixels


def set_px(pixels, w, h, x, y, rgb, a=1.0):
    if x < 0 or y < 0 or x >= w or y >= h:
        return
    i = (y * w + x) * 3
    pixels[i] = clamp(int(pixels[i] * (1 - a) + rgb[0] * a))
    pixels[i + 1] = clamp(int(pixels[i + 1] * (1 - a) + rgb[1] * a))
    pixels[i + 2] = clamp(int(pixels[i + 2] * (1 - a) + rgb[2] * a))


def fill_circle(pixels, w, h, cx, cy, rad, rgb, a=1.0):
    r2 = rad * rad
    for y in range(max(0, cy - rad), min(h, cy + rad + 1)):
        for x in range(max(0, cx - rad), min(w, cx + rad + 1)):
            d2 = (x - cx) ** 2 + (y - cy) ** 2
            if d2 <= r2:
                aa = a * (1.0 - math.sqrt(d2) / rad * 0.35)
                set_px(pixels, w, h, x, y, rgb, aa)


def draw_motif(pixels, w, h, mood, c2, c3, seed):
    rng = random.Random(seed)
    if mood == "space":
        for _ in range(180):
            x, y = rng.randint(0, w - 1), rng.randint(0, int(h * 0.7))
            set_px(pixels, w, h, x, y, (255, 255, 255), 0.5 + rng.random() * 0.5)
        # planet
        fill_circle(pixels, w, h, int(w * 0.7), int(h * 0.55), int(min(w, h) * 0.18), c2, 0.55)
        fill_circle(pixels, w, h, int(w * 0.7), int(h * 0.55), int(min(w, h) * 0.12), mix(c2, (20, 20, 40), 0.4), 0.4)
    elif mood == "matrix":
        for col in range(0, w, 8):
            for row in range(0, h, 10):
                if rng.random() > 0.55:
                    set_px(pixels, w, h, col + rng.randint(0, 2), row, c2, 0.35 + rng.random() * 0.4)
    elif mood == "desert" or mood == "savanna":
        # dunes / hills
        for x in range(w):
            dune = int(h * (0.58 + 0.08 * math.sin(x * 0.02 + seed) + 0.04 * math.sin(x * 0.05)))
            for y in range(dune, h):
                set_px(pixels, w, h, x, y, mix(c2, (40, 25, 10), (y - dune) / max(1, h - dune)), 0.35)
        if mood == "savanna":
            # sun
            fill_circle(pixels, w, h, int(w * 0.5), int(h * 0.38), int(h * 0.1), (255, 200, 80), 0.7)
    elif mood == "ocean":
        for x in range(w):
            wave = int(h * (0.48 + 0.02 * math.sin(x * 0.04 + seed * 0.1)))
            for y in range(wave, min(h, wave + 4)):
                set_px(pixels, w, h, x, y, (220, 230, 240), 0.25)
        # ship silhouette
        sx, sy = int(w * 0.45), int(h * 0.42)
        for dx in range(-40, 40):
            for dy in range(0, 8):
                set_px(pixels, w, h, sx + dx, sy + dy, (10, 15, 25), 0.8)
        for dy in range(-35, 0):
            set_px(pixels, w, h, sx, sy + dy, (10, 15, 25), 0.7)
    elif mood == "horror":
        # balloon
        fill_circle(pixels, w, h, int(w * 0.5), int(h * 0.38), int(h * 0.12), c2, 0.75)
        for y in range(int(h * 0.5), int(h * 0.75)):
            set_px(pixels, w, h, int(w * 0.5), y, (200, 200, 200), 0.5)
    elif mood == "neon" or mood == "80s":
        # stairs / city blocks silhouette
        for i in range(8):
            bx = int(w * (0.1 + i * 0.1))
            bh = int(h * (0.2 + rng.random() * 0.35))
            for x in range(bx, min(w, bx + 18)):
                for y in range(h - bh, h):
                    set_px(pixels, w, h, x, y, (5, 5, 10), 0.65)
    elif mood == "dream":
        # city tilt illusion — stacked rectangles
        for i in range(5):
            ox = int(w * (0.25 + i * 0.08))
            oy = int(h * (0.55 - i * 0.06))
            for x in range(ox, min(w, ox + 50)):
                for y in range(oy, min(h, oy + 90)):
                    if (x + y + i) % 7 != 0:
                        set_px(pixels, w, h, x, y, mix(c3, (20, 30, 50), 0.5), 0.25)
    elif mood == "hotel":
        # twin doors suggestion
        for side in (-1, 1):
            cx = int(w * 0.5 + side * w * 0.12)
            for x in range(cx - 18, cx + 18):
                for y in range(int(h * 0.35), int(h * 0.75)):
                    set_px(pixels, w, h, x, y, (30, 20, 25), 0.4)
    elif mood == "xmas":
        # house silhouette
        for x in range(int(w * 0.3), int(w * 0.7)):
            for y in range(int(h * 0.55), int(h * 0.85)):
                set_px(pixels, w, h, x, y, (25, 20, 30), 0.55)
        for x in range(int(w * 0.25), int(w * 0.75)):
            roof = abs(x - w // 2) / (w * 0.25)
            if roof < 1:
                y0 = int(h * (0.55 - (1 - roof) * 0.12))
                for y in range(y0, int(h * 0.55)):
                    set_px(pixels, w, h, x, y, (180, 40, 40), 0.5)
    elif mood == "house":
        for x in range(int(w * 0.2), int(w * 0.8)):
            for y in range(int(h * 0.4), int(h * 0.8)):
                set_px(pixels, w, h, x, y, mix(c3, (40, 50, 40), 0.3), 0.2)
    elif mood == "paris":
        # tower hint
        for y in range(int(h * 0.2), int(h * 0.75)):
            width = max(2, int(12 * (1 - (y - h * 0.2) / (h * 0.55))))
            for x in range(w // 2 - width, w // 2 + width):
                set_px(pixels, w, h, x, y, (30, 35, 50), 0.45)
    elif mood == "epic":
        for i in range(6):
            bx = int(w * (0.15 + i * 0.12))
            bh = int(h * (0.15 + (i % 3) * 0.1))
            for x in range(bx, min(w, bx + 22)):
                for y in range(h - bh, h):
                    set_px(pixels, w, h, x, y, (8, 10, 20), 0.7)


def draw_title_bar(pixels, w, h, meta, wide: bool):
    # bottom cinematic bar + title as soft glow blocks (no font dependency)
    title = meta["title"]
    year = meta["year"]
    bar_y0 = int(h * (0.78 if not wide else 0.82))
    for y in range(bar_y0, h):
        t = (y - bar_y0) / max(1, h - bar_y0)
        for x in range(w):
            set_px(pixels, w, h, x, y, (0, 0, 0), 0.35 + t * 0.55)

    # fake typography: letter blocks from title hash — looks like title plate
    rng = random.Random(sum(ord(c) for c in title) + w)
    cx = w // 2
    letter_w = max(6, w // max(8, len(title) + 2))
    total = len(title) * (letter_w + 2)
    start = max(8, cx - total // 2)
    y_mid = int(h * (0.86 if not wide else 0.90))
    for i, ch in enumerate(title):
        if ch == " ":
            continue
        lx = start + i * (letter_w + 2)
        lh = 10 + (ord(ch) % 7)
        for x in range(lx, min(w - 2, lx + letter_w - 2)):
            for y in range(y_mid - lh, y_mid + 2):
                set_px(pixels, w, h, x, y, (245, 240, 230), 0.75)
        # serif foot
        for x in range(lx, min(w - 2, lx + letter_w - 2)):
            set_px(pixels, w, h, x, y_mid + 3, (200, 180, 140), 0.5)

    # year dots
    for i, ch in enumerate(year):
        ox = cx - 20 + i * 12
        for x in range(ox, ox + 8):
            for y in range(y_mid + 12, y_mid + 18):
                set_px(pixels, w, h, x, y, (180, 160, 120), 0.6)


def crc(data: bytes) -> int:
    return zlib.crc32(data) & 0xFFFFFFFF


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc(tag + data))


def write_png(path: Path, w: int, h: int, pixels: bytearray):
    # Write as PNG then optionally user sees jpg path — we'll write real JPEG via crude method
    # Actually write PNG with .jpg extension renamed — browsers need real jpeg.
    # Use PNG files named .png and update references, OR implement minimal JPEG.
    raw = b"".join(b"\x00" + bytes(pixels[y * w * 3 : (y + 1) * w * 3]) for y in range(h))
    compressed = zlib.compress(raw, 6)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", compressed)
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def try_jpeg(path: Path, w: int, h: int, pixels: bytearray) -> bool:
    try:
        from PIL import Image

        img = Image.frombytes("RGB", (w, h), bytes(pixels))
        img.save(path, "JPEG", quality=88, optimize=True)
        return True
    except Exception:
        return False


def main():
    POSTERS.mkdir(parents=True, exist_ok=True)
    BGS.mkdir(parents=True, exist_ok=True)
    ok = 0
    for mid, meta in MOVIES.items():
        seed = mid * 1009 + 7
        # poster 400x600
        pp = make_pixels(400, 600, meta, seed, wide=False)
        poster_path = POSTERS / f"real-{mid}.jpg"
        if not try_jpeg(poster_path, 400, 600, pp):
            png_path = POSTERS / f"real-{mid}.png"
            write_png(png_path, 400, 600, pp)
            poster_path = png_path
        # background 1280x720
        bp = make_pixels(960, 540, meta, seed + 3, wide=True)
        bg_path = BGS / f"real-{mid}.jpg"
        if not try_jpeg(bg_path, 960, 540, bp):
            png_path = BGS / f"real-{mid}.png"
            write_png(png_path, 960, 540, bp)
            bg_path = png_path
        print(f"OK {mid} {poster_path.name} {bg_path.name} {poster_path.stat().st_size}")
        ok += 1
    print(f"DONE {ok}")


if __name__ == "__main__":
    main()
