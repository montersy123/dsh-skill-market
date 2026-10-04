"""Trim the uniform margin from a screenshot.

The drawer crop carries roughly 580px of empty panel below its last row of content, which makes the illustration
look broken in a README where the image is scaled to the text width. The content ends where the pixels stop
varying, so the trim is measured.
"""

from pathlib import Path
import sys

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[2]


def trim(path: Path, keep_bottom: int = 24, keep_right: int = 0) -> None:
    """Trim a uniform surrounding margin, keeping a small margin below and to the right."""
    image = Image.open(path).convert("RGB")
    width, height = image.size

    # Compare each row against the image's bottom-right pixel, which is part of the panel's empty area.
    background = image.getpixel((width - 2, height - 2))
    last_content = height - 1
    for y in range(height - 1, -1, -1):
        row = [image.getpixel((x, y)) for x in range(0, width, max(1, width // 60))]
        if any(max(abs(pixel[i] - background[i]) for i in range(3)) > 8 for pixel in row):
            last_content = y
            break

    last_column = width - 1
    for x in range(width - 1, -1, -1):
        column = [image.getpixel((x, y)) for y in range(0, height, max(1, height // 60))]
        if any(max(abs(pixel[i] - background[i]) for i in range(3)) > 8 for pixel in column):
            last_column = x
            break

    bottom = min(height, last_content + 1 + keep_bottom)
    right = min(width, last_column + 1 + keep_right)
    cropped = image.crop((0, 0, right, bottom))
    cropped.save(path)
    print(f"  {path.name}: {width}x{height} -> {cropped.size[0]}x{cropped.size[1]}  ({path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    target = ROOT / "assets" / (sys.argv[1] if len(sys.argv) > 1 else "detail-en.png")
    trim(target)
