"""Locate the details drawer in the English screenshot and crop it out as its own image.

The English README has one screenshot that contains both the market and the drawer, so the "details drawer"
section had nothing of its own and ended up reusing the hero image. Cropping the drawer gives that section a
correct illustration instead of a duplicate.

The crop boundary is measured rather than guessed: the drawer is a distinct panel, so scanning a horizontal line
for where the panel's background starts finds it reliably.
"""

from pathlib import Path
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "discover-detail-en.png"
OUTPUT = ROOT / "assets" / "detail-en.png"

image = Image.open(SOURCE).convert("RGB")
width, height = image.size
print(f"  source : {SOURCE.name}  {width} x {height}")

# The drawer's left edge, measured from the screenshot rather than guessed: several rows show the page scrim at
# (203,202,203) running up to a border pixel at (191,190,191), with the panel's white surface starting at x=1998.
# An earlier attempt scanned a single row and landed between cards, where the page background is also light.
LEFT_EDGE = 1998

image = Image.open(SOURCE).convert("RGB")
width, height = image.size
print(f"  source : {SOURCE.name}  {width} x {height}")

# Confirm the edge on several rows before trusting it: the border pixel is distinct from both the scrim and the
# panel, so requiring it at the same column each time is a real check rather than a formality.
confirmed = 0
for fraction in (0.25, 0.40, 0.55, 0.75):
    y = int(height * fraction)
    border = image.getpixel((LEFT_EDGE - 1, y))
    surface = image.getpixel((LEFT_EDGE, y))
    if surface[0] > 240 and border[0] < 230:
        confirmed += 1
print(f"  edge confirmed on {confirmed}/4 sampled rows (panel white at x={LEFT_EDGE}, border darker at x={LEFT_EDGE - 1})")
if confirmed < 3:
    print("  FAIL: the edge is not consistent across rows; refusing to crop")
    sys.exit(1)

# Keep the border column so the panel's own left rule is included.
cropped = image.crop((LEFT_EDGE - 1, 0, width, height))
cropped.save(OUTPUT)
print(f"  wrote  : {OUTPUT.name}  {cropped.size[0]} x {cropped.size[1]}  ({OUTPUT.stat().st_size:,} bytes)")
