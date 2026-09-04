#!/usr/bin/env python3
"""Regenerates public/icons/*.png and public/logo/*.png from the firm's
actual logo.

The source is the letterhead logo already embedded in the report template
(docs/templates/field-report-template.docx, word/media/image1.png) — the
building icon + "WISEMAN+ROHY STRUCTURAL ENGINEERS" wordmark. This script
crops out just the building mark and composites it onto the icon shapes a
PWA needs (a rounded-square "any" icon, a full-bleed "maskable" one with
extra safe-zone padding, and the small favicon sizes), and separately saves
the full logo (mark + wordmark, transparent background, untouched — its
native 784x168 already has plenty of headroom for how small it's ever
displayed) for use in the app's own UI chrome.

One-time authoring step, not part of the app or its build — re-run only if
the firm sends an updated logo file. Requires Pillow (`pip install
pillow`) and a copy of the template docx.

Usage:
    python3 scripts/generate-app-icons.py [path-to-template.docx]
"""
import sys
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_TEMPLATE = REPO_ROOT / "docs" / "templates" / "field-report-template.docx"
OUT_DIR = REPO_ROOT / "public" / "icons"
LOGO_OUT_DIR = REPO_ROOT / "public" / "logo"

# Established by inspecting the source image: the building mark (including
# its ground-line swoosh) occupies the left 190px of the 784x168 logo,
# before the "WISEMAN" wordmark starts.
MARK_CROP_WIDTH = 190
WHITE = (253, 253, 253, 255)


def load_full_logo(template_path: Path) -> Image.Image:
    with zipfile.ZipFile(template_path) as zf:
        data = zf.read("word/media/image1.png")
    import io

    return Image.open(io.BytesIO(data)).convert("RGBA")


def extract_mark(full_logo: Image.Image) -> Image.Image:
    return full_logo.crop((0, 0, MARK_CROP_WIDTH, full_logo.height))


def compose(mark: Image.Image, canvas_size: int, fill_fraction: float, rounded: bool, out_path: Path) -> None:
    mw, mh = mark.size
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    if rounded:
        radius = int(canvas_size * 0.18)
        draw.rounded_rectangle((0, 0, canvas_size, canvas_size), radius=radius, fill=WHITE)
    else:
        # Maskable icons must fill the whole canvas — the OS applies its
        # own shape mask, so a pre-rounded background would double up.
        draw.rectangle((0, 0, canvas_size, canvas_size), fill=WHITE)

    target_w = canvas_size * fill_fraction
    scale = target_w / mw
    new_size = (round(mw * scale), round(mh * scale))
    resized = mark.resize(new_size, Image.LANCZOS)

    x = (canvas_size - new_size[0]) // 2
    y = (canvas_size - new_size[1]) // 2
    canvas.alpha_composite(resized, (x, y))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out_path)
    print(f"wrote {out_path.relative_to(REPO_ROOT)} ({canvas_size}x{canvas_size}, mark {new_size[0]}x{new_size[1]})")


def main() -> None:
    template_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_TEMPLATE
    if not template_path.exists():
        print(f"Template not found: {template_path}", file=sys.stderr)
        sys.exit(1)

    full_logo = load_full_logo(template_path)
    mark = extract_mark(full_logo)

    # (canvas size, mark fill fraction, pre-rounded background)
    # 0.78 fill / rounded matches how most OSes render a standard app icon;
    # maskable is deliberately smaller (0.60) and unrounded — the safe zone
    # a launcher won't clip is a centered circle at ~80% of canvas diameter.
    compose(mark, 192, 0.78, True, OUT_DIR / "icon-192.png")
    compose(mark, 512, 0.78, True, OUT_DIR / "icon-512.png")
    compose(mark, 512, 0.60, False, OUT_DIR / "icon-512-maskable.png")
    compose(mark, 180, 0.78, True, OUT_DIR / "apple-touch-icon.png")
    compose(mark, 64, 0.82, True, OUT_DIR / "favicon-64.png")
    compose(mark, 32, 0.82, True, OUT_DIR / "favicon-32.png")

    LOGO_OUT_DIR.mkdir(parents=True, exist_ok=True)
    logo_out_path = LOGO_OUT_DIR / "wr-full-logo.png"
    full_logo.save(logo_out_path)
    print(f"wrote {logo_out_path.relative_to(REPO_ROOT)} ({full_logo.width}x{full_logo.height}, transparent bg)")


if __name__ == "__main__":
    main()
