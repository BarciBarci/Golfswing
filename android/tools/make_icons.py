#!/usr/bin/env python3
"""Regenerate all Android launcher icons from the web app's master icon.

The master icon lives at the repository root in icons/icon-512.png (single
source of truth, used by the PWA manifest as well). This script writes the
Android launcher icons into android/app/src/main/res/.

Run it from anywhere:

    python3 android/tools/make_icons.py
    (or:  python3 tools/make_icons.py   from inside android/)

Only needs the Python standard library plus Pillow.
"""
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required:  pip3 install Pillow")

# android/tools/make_icons.py -> android/tools -> android -> repository root
ANDROID_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = ANDROID_DIR.parent
MASTER = REPO_ROOT / "icons" / "icon-512.png"
RES_DIR = ANDROID_DIR / "app" / "src" / "main" / "res"

# density name -> (legacy launcher px, adaptive foreground canvas px)
# legacy: 48dp icon, foreground: 108dp adaptive canvas
DPI = {
    "mdpi": (48, 108),
    "hdpi": (72, 162),
    "xhdpi": (96, 216),
    "xxhdpi": (144, 324),
    "xxxhdpi": (192, 432),
}

# The artwork is scaled to this fraction of the adaptive canvas so the launcher
# mask only cuts off the transparent corners, never the artwork itself.
ADAPTIVE_SCALE = 0.92


def main():
    if not MASTER.is_file():
        sys.exit(f"Master icon not found: {MASTER}")
    art = Image.open(MASTER).convert("RGBA")

    for density, (legacy_px, fg_canvas) in DPI.items():
        mipmap = RES_DIR / f"mipmap-{density}"

        # Plain launcher icon (used on Android < 8.0 and as a base resource).
        leg = art.resize((legacy_px, legacy_px), Image.LANCZOS)
        leg.save(mipmap / "ic_launcher.png")

        # Adaptive-icon foreground: transparent canvas + centered artwork.
        canvas = Image.new("RGBA", (fg_canvas, fg_canvas), (0, 0, 0, 0))
        art_px = round(fg_canvas * ADAPTIVE_SCALE)
        scaled = art.resize((art_px, art_px), Image.LANCZOS)
        offset = (fg_canvas - art_px) // 2
        canvas.paste(scaled, (offset, offset), scaled)
        canvas.save(mipmap / "ic_launcher_foreground.png")

    print("Launcher icons written to", RES_DIR)


if __name__ == "__main__":
    main()
