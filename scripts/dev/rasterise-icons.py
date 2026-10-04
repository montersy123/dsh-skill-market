"""Rasterise the icon sheet described by a JSON payload.

Pairs with ``render-icons.mjs``, which extracts the glyph paths from the client bundle. There is no
SVG renderer in the bundled Python, so the path data is parsed and drawn with Pillow: curves are
flattened into short polylines, which is all a 24x24 stroked icon needs to be judged by eye.

    python rasterise-icons.py icons-payload.json
"""

from __future__ import annotations

import json
import math
import re
import sys

from PIL import Image, ImageDraw

BG = (13, 16, 23)
CARD = (20, 24, 33)
CARD_EDGE = (42, 49, 64)
INK = (230, 235, 245)
LABEL = (139, 147, 167)

TOKEN = re.compile(r"[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e[-+]?\d+)?", re.IGNORECASE)


def tokenize(path: str) -> list[str]:
    """Split path data into commands and numbers."""
    return TOKEN.findall(path)


def flatten(path: str, steps: int = 24) -> list[list[tuple[float, float]]]:
    """Turn path data into polylines of absolute points."""
    tokens = tokenize(path)
    polylines: list[list[tuple[float, float]]] = []
    current: list[tuple[float, float]] = []
    x = y = 0.0
    start = (0.0, 0.0)
    command = ""
    index = 0

    def number() -> float:
        nonlocal index
        value = float(tokens[index])
        index += 1
        return value

    def bezier(p0, p1, p2, p3):
        points = []
        for step in range(1, steps + 1):
            t = step / steps
            u = 1 - t
            points.append((
                u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
                u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1],
            ))
        return points

    def arc(p0, rx, ry, rotation, large, sweep, p1):
        """Flatten an elliptical arc using the endpoint parameterisation from the SVG spec."""
        if rx == 0 or ry == 0:
            return [p1]
        phi = math.radians(rotation)
        cos_phi, sin_phi = math.cos(phi), math.sin(phi)
        dx2, dy2 = (p0[0] - p1[0]) / 2, (p0[1] - p1[1]) / 2
        x1p = cos_phi * dx2 + sin_phi * dy2
        y1p = -sin_phi * dx2 + cos_phi * dy2
        rx, ry = abs(rx), abs(ry)
        lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
        if lam > 1:
            scale = math.sqrt(lam)
            rx, ry = rx * scale, ry * scale
        sign = -1 if large == sweep else 1
        numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
        denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p
        coefficient = sign * math.sqrt(max(0.0, numerator / denominator)) if denominator else 0.0
        cxp = coefficient * rx * y1p / ry
        cyp = -coefficient * ry * x1p / rx
        cx = cos_phi * cxp - sin_phi * cyp + (p0[0] + p1[0]) / 2
        cy = sin_phi * cxp + cos_phi * cyp + (p0[1] + p1[1]) / 2

        def angle(ux, uy, vx, vy):
            dot = ux * vx + uy * vy
            norm = math.hypot(ux, uy) * math.hypot(vx, vy)
            value = max(-1.0, min(1.0, dot / norm)) if norm else 1.0
            theta = math.acos(value)
            return -theta if (ux * vy - uy * vx) < 0 else theta

        ux, uy = (x1p - cxp) / rx, (y1p - cyp) / ry
        vx, vy = (-x1p - cxp) / rx, (-y1p - cyp) / ry
        theta1 = angle(1, 0, ux, uy)
        delta = angle(ux, uy, vx, vy)
        if sweep == 0 and delta > 0:
            delta -= 2 * math.pi
        elif sweep == 1 and delta < 0:
            delta += 2 * math.pi
        points = []
        for step in range(1, steps + 1):
            theta = theta1 + delta * step / steps
            px = cx + rx * math.cos(theta) * cos_phi - ry * math.sin(theta) * sin_phi
            py = cy + rx * math.cos(theta) * sin_phi + ry * math.sin(theta) * cos_phi
            points.append((px, py))
        return points

    while index < len(tokens):
        token = tokens[index]
        if token.isalpha():
            command = token
            index += 1
            if command in "Zz":
                if current:
                    current.append(start)
                    polylines.append(current)
                    current = []
                x, y = start
                continue
        relative = command.islower()
        upper = command.upper()
        if upper == "M":
            if current:
                polylines.append(current)
                current = []
            nx, ny = number(), number()
            x, y = (x + nx, y + ny) if relative else (nx, ny)
            start = (x, y)
            current = [(x, y)]
            command = "l" if relative else "L"
        elif upper == "L":
            nx, ny = number(), number()
            x, y = (x + nx, y + ny) if relative else (nx, ny)
            current.append((x, y))
        elif upper == "H":
            nx = number()
            x = x + nx if relative else nx
            current.append((x, y))
        elif upper == "V":
            ny = number()
            y = y + ny if relative else ny
            current.append((x, y))
        elif upper == "C":
            p1 = (number(), number())
            p2 = (number(), number())
            p3 = (number(), number())
            if relative:
                p1 = (x + p1[0], y + p1[1])
                p2 = (x + p2[0], y + p2[1])
                p3 = (x + p3[0], y + p3[1])
            current.extend(bezier((x, y), p1, p2, p3))
            x, y = p3
        elif upper == "S":
            p2 = (number(), number())
            p3 = (number(), number())
            if relative:
                p2 = (x + p2[0], y + p2[1])
                p3 = (x + p3[0], y + p3[1])
            previous = current[-2] if len(current) >= 2 else (x, y)
            p1 = (2 * x - previous[0], 2 * y - previous[1])
            current.extend(bezier((x, y), p1, p2, p3))
            x, y = p3
        elif upper == "Q":
            p1 = (number(), number())
            p2 = (number(), number())
            if relative:
                p1 = (x + p1[0], y + p1[1])
                p2 = (x + p2[0], y + p2[1])
            control = (x + 2 / 3 * (p1[0] - x), y + 2 / 3 * (p1[1] - y))
            control2 = (p2[0] + 2 / 3 * (p1[0] - p2[0]), p2[1] + 2 / 3 * (p1[1] - p2[1]))
            current.extend(bezier((x, y), control, control2, p2))
            x, y = p2
        elif upper == "A":
            rx, ry = number(), number()
            rotation = number()
            large, sweep = int(number()), int(number())
            nx, ny = number(), number()
            end = (x + nx, y + ny) if relative else (nx, ny)
            current.extend(arc((x, y), rx, ry, rotation, large, sweep, end))
            x, y = end
        else:
            raise ValueError(f"unsupported path command: {command}")

    if current:
        polylines.append(current)
    return polylines


def draw_glyph(draw, path, x, y, box, stroke_factor=1.7):
    """Draw one glyph stroke-only, centred in a ``box`` square whose top-left is (x, y)."""
    factor = box / 24
    stroke = max(2, round(stroke_factor * factor))
    for polyline in flatten(path):
        points = [(x + px * factor, y + py * factor) for px, py in polyline]
        if len(points) > 1:
            draw.line(points, fill=INK, width=stroke, joint="curve")
        elif len(points) == 1:
            # A lone point would be invisible when stroked; SVG's round caps make it a dot.
            px, py = points[0]
            radius = stroke / 2
            draw.ellipse([px - radius, py - radius, px + radius, py + radius], fill=INK)


def main() -> int:
    payload = json.loads(open(sys.argv[1], encoding="utf-8").read())
    cell = payload["cell"]
    columns = payload["columns"]
    names = payload["names"]
    paths = payload["paths"]
    actual_sizes = payload.get("actualPixelSizes", [])

    rows = math.ceil(len(names) / columns)
    scale = 4
    width = columns * cell
    # The sheet, then one labelled strip per real size, so the same glyph can be compared at both.
    strip_height = 34
    height = rows * cell + len(actual_sizes) * strip_height
    image = Image.new("RGB", (width * scale, height * scale), BG)
    draw = ImageDraw.Draw(image)

    for index, (name, path) in enumerate(zip(names, paths)):
        col, row = index % columns, index // columns
        ox, oy = col * cell * scale, row * cell * scale

        draw.rounded_rectangle(
            [ox + 5 * scale, oy + 5 * scale, ox + (cell - 5) * scale, oy + (cell - 5) * scale],
            radius=11 * scale, fill=CARD, outline=CARD_EDGE, width=2 * scale,
        )
        box = (cell - 34) * scale
        draw_glyph(draw, path, ox + (cell * scale - box) / 2, oy + (cell * scale - box) / 2 - 5 * scale, box)
        draw.text(
            (ox + cell * scale / 2, oy + (cell - 15) * scale),
            name.replace("i-", ""), fill=LABEL, anchor="mm",
        )

    # Actual-size strips: drawn at the real pixel size on a 4x canvas so the resample at the end
    # shrinks them exactly as the panel's own rendering would.
    strip_top = rows * cell
    column_width = (width * scale) // len(names)
    for strip_index, size in enumerate(actual_sizes):
        top = (strip_top + strip_index * strip_height) * scale
        draw.line([(0, top), (width * scale, top)], fill=CARD_EDGE, width=scale)
        draw.text(
            (10 * scale, (strip_top + strip_index * strip_height + 17) * scale),
            f"{size}px", fill=LABEL, anchor="lm",
        )
        for index, path in enumerate(paths):
            box = size * scale
            cx = column_width * index + column_width / 2
            draw_glyph(draw, path, cx - box / 2, top + (strip_height * scale - box) / 2, box)

    image = image.resize((width, height), Image.LANCZOS)
    image.save(payload["out"])
    print(f"  wrote {payload['out']}  ({len(names)} glyph(s), {width}x{height})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
