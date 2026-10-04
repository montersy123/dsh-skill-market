"""Crop the Add-plugin dialog out of a Plugins-page screenshot.

The dialog is a large light panel, but a naive centre-line scan stops early: the line runs into the grey install-source
chip inside the dialog and treats it as the edge. Detecting the panel per row and then taking the widest consistent
band finds the real boundary.
"""

from pathlib import Path
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]


def light_runs(image: Image.Image, y: int, threshold: int = 244) -> list[tuple[int, int]]:
    """Contiguous runs of near-white pixels on one row."""
    width, _ = image.size
    runs: list[tuple[int, int]] = []
    start = None
    for x in range(width):
        bright = min(image.getpixel((x, y))) >= threshold
        if bright and start is None:
            start = x
        elif not bright and start is not None:
            runs.append((start, x - 1))
            start = None
    if start is not None:
        runs.append((start, width - 1))
    return runs


def main() -> None:
    source = ROOT / "assets" / (sys.argv[1] if len(sys.argv) > 1 else "add-plugin.png")
    output_name = sys.argv[2] if len(sys.argv) > 2 else "add-plugin-dialog.png"

    image = Image.open(source).convert("RGB")
    width, height = image.size
    print(f"  source : {source.name}  {width} x {height}")

    # The dialog is the widest light run that persists across many rows. Collect the widest run per row, then keep
    # the rows whose run is within 2% of the modal width — that excludes the narrow gaps between page rows.
    candidates = []
    for y in range(height):
        runs = light_runs(image, y)
        if not runs:
            continue
        start, end = max(runs, key=lambda run: run[1] - run[0])
        candidates.append((y, start, end, end - start + 1))

    if not candidates:
        print("  FAIL: no light panel found")
        sys.exit(1)

    widest = max(candidate[3] for candidate in candidates)
    band = [candidate for candidate in candidates if candidate[3] >= widest * 0.97]
    top = min(candidate[0] for candidate in band)
    bottom = max(candidate[0] for candidate in band)
    left = min(candidate[1] for candidate in band)
    right = max(candidate[2] for candidate in band)
    print(f"  dialog : x={left}..{right}  y={top}..{bottom}  ({right - left + 1} x {bottom - top + 1}), modal width {widest}")

    if (right - left + 1) < 300 or (bottom - top + 1) < 200:
        print("  FAIL: the measured panel is too small to be a dialog; refusing to crop")
        sys.exit(1)

    margin = 14
    cropped = image.crop((
        max(0, left - margin), max(0, top - margin),
        min(width, right + margin), min(height, bottom + margin),
    ))
    output = ROOT / "assets" / output_name
    cropped.save(output)
    print(f"  wrote  : {output.name}  {cropped.size[0]} x {cropped.size[1]}  ({output.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
