#!/usr/bin/env python3
"""Build original, self-contained 0n26 CRT robot vectors and pixel previews.

Run from any directory: python scripts/generate-mascot.py
Requires Pillow. Every visible shape is drawn here, with no source-image tracing,
external images, font dependencies in SVGs, or JavaScript in the assets.
"""

from pathlib import Path
from html import escape
import json

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets" / "mascot"
W, H = 96, 112

INK = "#111518"
BLACK = "#090C0E"
DEEP = "#1B2125"
DARK = "#252D32"
MID = "#354148"
EDGE = "#566166"
LIT = "#7C8585"
IVORY = "#F0EEE7"
CYAN = "#A6D9ED"
SCREEN = "#142127"
DIM = "#527B8B"

STATES = {
    "idle": "The exact 0n26 wordmark lights up the CRT screen.",
    "blink": "A quick relaxed blink, with two closed eyes.",
    "happy": "Two smiling eyes and a bright open smile.",
    "curious": "One raised eyebrow and an inquisitive expression.",
    "surprised": "Wide eyes and a tiny round open mouth.",
    "sleepy": "Heavy eyelids and a tiny sleepy z.",
    "walk": "A cheerful mid-step pose, with one foot lifted.",
    "wave": "A raised articulated hand waves hello.",
}

# Pixel lettering, rather than platform-dependent font rendering.
FONT = {
    "0": ["0110", "1001", "1011", "1101", "1001", "1001", "0110"],
    "n": ["0000", "0000", "1110", "1001", "1001", "1001", "1001"],
    "2": ["0110", "1001", "0001", "0010", "0100", "1000", "1111"],
    "6": ["0111", "1000", "1000", "1110", "1001", "1001", "0110"],
}
SMALL_FONT = {
    "0": ["111", "101", "101", "101", "111"],
    "n": ["000", "000", "110", "101", "101"],
    "2": ["110", "001", "010", "100", "111"],
    "6": ["011", "100", "110", "101", "111"],
    "z": ["111", "001", "010", "100", "111"],
}


class PixelDrawing:
    """One integer-coordinate scene graph, exported as SVG and RGBA PNG."""

    def __init__(self):
        self.shapes = []

    def rect(self, x, y, w, h, fill, opacity=1):
        self.shapes.append(("rect", (x, y, w, h), fill, opacity))

    def poly(self, points, fill, opacity=1):
        self.shapes.append(("polygon", points, fill, opacity))

    def label(self, text, x, y, scale=1, small=False, fill=CYAN):
        alphabet = SMALL_FONT if small else FONT
        for char in text:
            glyph = alphabet[char]
            for row, values in enumerate(glyph):
                for col, value in enumerate(values):
                    if value == "1":
                        self.rect(x + col * scale, y + row * scale,
                                  scale, scale, fill)
            x += (len(glyph[0]) + 1) * scale

    def svg(self, state):
        parts = [
            '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="112" '
            'viewBox="0 0 96 112" shape-rendering="crispEdges" role="img" '
            'aria-labelledby="title desc">',
            f'<title id="title">0n26 CRT robot: {escape(state)}</title>',
            f'<desc id="desc">Original graphite pixel robot with a curved antenna, '
            f'pale cyan phosphor, ivory highlights, and a permanent 0n26 chest badge. '
            f'{escape(STATES[state])}</desc>',
        ]
        for kind, values, fill, opacity in self.shapes:
            alpha = f' opacity="{opacity:g}"' if opacity != 1 else ""
            if kind == "rect":
                x, y, w, h = values
                parts.append(f'<rect x="{x}" y="{y}" width="{w}" '
                             f'height="{h}" fill="{fill}"{alpha}/>')
            else:
                points = " ".join(f"{x},{y}" for x, y in values)
                parts.append(f'<polygon points="{points}" fill="{fill}"{alpha}/>')
        return "\n".join(parts + ["</svg>", ""])

    def png(self, scale=4):
        canvas = Image.new("RGBA", (W * scale, H * scale))
        for kind, values, fill, opacity in self.shapes:
            layer = Image.new("RGBA", canvas.size)
            draw = ImageDraw.Draw(layer)
            rgb = tuple(int(fill[i:i + 2], 16) for i in (1, 3, 5))
            color = rgb + (round(opacity * 255),)
            if kind == "rect":
                x, y, w, h = values
                draw.rectangle((x * scale, y * scale,
                                (x + w) * scale - 1, (y + h) * scale - 1), fill=color)
            else:
                # Draw SVG polygons through a raster scanline fill. Sampling the
                # center of each pixel keeps SVG's exclusive right/bottom edges.
                points = values
                for y in range(H):
                    yy = y + .5
                    intersections = []
                    for i, (x1, y1) in enumerate(points):
                        x2, y2 = points[(i + 1) % len(points)]
                        if (y1 <= yy < y2) or (y2 <= yy < y1):
                            intersections.append(x1 + (yy-y1) * (x2-x1)/(y2-y1))
                    intersections.sort()
                    for left, right in zip(intersections[::2], intersections[1::2]):
                        import math
                        a, b = math.ceil(left - .5), math.ceil(right - .5)
                        if b > a:
                            draw.rectangle((a * scale, y * scale,
                                            b * scale - 1, (y+1) * scale - 1), fill=color)
            canvas = Image.alpha_composite(canvas, layer)
        return canvas


def antenna(d):
    d.poly([(44,29),(44,23),(41,23),(41,20),(38,20),(38,11),
            (40,11),(40,6),(44,6),(44,3),(54,3),(54,4),(59,4),
            (59,6),(63,6),(63,10),(65,10),(65,16),(61,16),
            (61,11),(59,11),(59,9),(54,9),(54,8),(47,8),
            (47,10),(44,10),(44,17),(47,17),(47,21),(50,21),(50,29)], BLACK)
    d.poly([(45,27),(45,22),(42,22),(42,19),(40,19),(40,11),
            (42,11),(42,7),(45,7),(45,5),(54,5),(54,6),(59,6),
            (59,8),(61,8),(61,11),(63,11),(63,16),(62,16),
            (62,11),(60,11),(60,9),(57,9),(57,7),(46,7),
            (46,9),(42,9),(42,18),(45,18),(45,21),(48,21),(48,27)], MID)
    d.rect(44,5,10,1,EDGE)
    d.rect(41,8,2,3,EDGE)
    d.rect(40,12,1,5,EDGE)
    d.rect(44,20,2,2,EDGE)
    d.rect(48,4,5,1,IVORY,.40)
    d.poly([(62,13),(68,13),(68,15),(71,15),(71,21),(68,21),
            (68,23),(62,23),(62,21),(60,21),(60,15),(62,15)], BLACK)
    d.poly([(63,15),(68,15),(68,17),(69,17),(69,20),(67,20),
            (67,21),(63,21),(63,20),(62,20),(62,17),(63,17)], MID)
    d.rect(63,15,4,2,EDGE)
    d.rect(64,15,2,1,IVORY,.65)
    d.rect(62,18,1,2,LIT,.55)
    d.rect(42,25,11,4,BLACK)
    d.rect(44,25,7,2,EDGE)


def neutral_arms(d, include_right=True):
    # Two small shoulder collars and articulated forearms, behind the torso.
    d.poly([(32,76),(37,76),(37,83),(34,83),(34,87),(32,87),
            (32,94),(28,94),(28,92),(25,92),(25,84),(28,84),
            (28,79),(32,79)], BLACK)
    d.poly([(31,80),(34,80),(34,84),(31,84),(31,89),(28,89),
            (28,85),(30,85),(30,81),(31,81)], MID)
    d.rect(28,90,4,2,DARK)
    d.rect(29,82,2,3,EDGE)
    d.rect(27,86,1,3,LIT,.45)
    d.rect(30,90,1,3,BLACK)
    if not include_right:
        return
    d.poly([(61,76),(66,76),(66,79),(69,79),(69,84),(72,84),
            (72,92),(69,92),(69,94),(65,94),(65,87),(63,87),
            (63,83),(61,83)], BLACK)
    d.poly([(64,80),(67,80),(67,85),(69,85),(69,89),(66,89),
            (66,84),(64,84)], DARK)
    d.rect(65,80,2,2,EDGE)
    d.rect(66,90,3,2,MID)
    d.rect(67,90,1,3,BLACK)


def wave_arms(d):
    neutral_arms(d, include_right=False)
    d.poly([(65,79),(69,79),(69,76),(74,76),(74,71),(78,71),
            (78,64),(83,64),(83,73),(80,73),(80,78),(75,78),
            (75,82),(68,82),(68,85),(65,85)], BLACK)
    d.poly([(66,80),(70,80),(70,78),(76,78),(76,73),(79,73),
            (79,66),(81,66),(81,72),(78,72),(78,77),(74,77),
            (74,80),(70,80),(70,82),(66,82)], MID)
    d.rect(76,73,3,2,EDGE)
    # Raised hand: three stepped fingers and an outside thumb.
    d.poly([(78,65),(78,59),(76,59),(76,54),(79,54),(79,56),
            (80,56),(80,49),(83,49),(83,47),(86,47),(86,49),
            (89,49),(89,52),(92,52),(92,61),(90,61),(90,65),
            (87,65),(87,68),(81,68),(81,65)], BLACK)
    d.poly([(80,63),(80,57),(78,57),(78,56),(79,56),(79,58),
            (82,58),(82,51),(83,51),(83,59),(84,59),(84,49),
            (85,49),(85,59),(86,59),(86,51),(87,51),(87,60),
            (88,60),(88,54),(90,54),(90,60),(88,60),(88,64),
            (85,64),(85,66),(82,66),(82,63)], MID)
    d.rect(82,60,5,3,EDGE)
    d.rect(83,60,3,1,LIT)
    d.rect(84,50,1,5,IVORY,.50)
    d.rect(87,52,1,4,LIT)


def walk_arms(d):
    d.poly([(33,77),(37,77),(37,84),(33,84),(33,89),(30,89),
            (30,94),(24,94),(24,91),(22,91),(22,86),(26,86),
            (26,83),(30,83),(30,79),(33,79)], BLACK)
    d.poly([(32,80),(35,80),(35,83),(31,83),(31,87),(28,87),
            (28,91),(25,91),(25,88),(28,88),(28,85),(32,85)], MID)
    d.rect(30,82,3,2,EDGE)
    d.rect(25,89,2,2,LIT,.55)
    d.poly([(62,77),(66,77),(66,80),(70,80),(70,82),(75,82),
            (75,86),(77,86),(77,91),(71,91),(71,88),(67,88),
            (67,85),(63,85)], BLACK)
    d.poly([(64,80),(67,80),(67,83),(72,83),(72,85),(74,85),
            (74,88),(72,88),(72,86),(68,86),(68,83),(64,83)], DARK)
    d.rect(65,80,2,2,EDGE)


def feet(d, walking=False):
    d.rect(39,91,21,9,BLACK)
    d.rect(41,94,17,3,MID)
    if not walking:
        d.poly([(36,96),(46,96),(46,105),(44,105),(44,108),
                (33,108),(33,106),(31,106),(31,102),(34,102),
                (34,98),(36,98)], BLACK)
        d.poly([(37,98),(44,98),(44,104),(42,104),(42,106),
                (34,106),(34,103),(37,103)], DARK)
        d.rect(37,98,6,2,MID)
        d.rect(34,103,8,1,EDGE)
        d.rect(34,105,9,1,INK)
        d.poly([(52,96),(62,96),(62,98),(64,98),(64,102),
                (67,102),(67,106),(65,106),(65,108),(54,108),
                (54,105),(52,105)], BLACK)
        d.poly([(54,98),(61,98),(61,103),(64,103),(64,106),
                (56,106),(56,104),(54,104)], DARK)
        d.rect(55,98,6,2,MID)
        d.rect(57,103,7,1,EDGE)
        d.rect(56,105,9,1,INK)
    else:
        d.poly([(36,95),(47,95),(47,100),(43,100),(43,105),
                (41,105),(41,109),(28,109),(28,106),(30,106),
                (30,102),(34,102),(34,98),(36,98)], BLACK)
        d.poly([(37,97),(44,97),(44,99),(41,99),(41,104),
                (39,104),(39,107),(31,107),(31,104),(35,104),
                (35,100),(37,100)], MID)
        d.rect(31,105,8,1,EDGE)
        d.rect(32,107,8,1,DARK)
        d.poly([(52,94),(61,94),(61,97),(65,97),(65,99),
                (70,99),(70,104),(67,104),(67,106),(56,106),
                (56,103),(53,103),(53,99),(51,99)], BLACK)
        d.poly([(54,96),(59,96),(59,99),(63,99),(63,101),
                (67,101),(67,103),(58,103),(58,101),(55,101)], DARK)
        d.rect(55,97,4,2,MID)
        d.rect(59,101,7,1,EDGE)


def body(d):
    d.rect(42,70,15,9,BLACK)
    d.rect(44,72,11,3,EDGE)
    d.rect(44,75,11,2,DARK)
    d.poly([(37,75),(61,75),(61,77),(64,77),(64,93),(61,93),
            (61,96),(37,96),(37,94),(34,94),(34,78),(37,78)], BLACK)
    d.poly([(38,77),(59,77),(59,79),(61,79),(61,92),(58,92),
            (58,94),(38,94),(38,92),(36,92),(36,79),(38,79)], DARK)
    d.rect(38,77,21,2,MID)
    d.rect(36,79,2,13,MID)
    d.rect(38,79,1,12,EDGE)
    d.rect(59,80,2,12,DEEP)
    d.rect(38,92,20,2,INK)
    # A permanent metal chest plaque; exact lowercase n, never a null symbol.
    d.rect(40,79,19,11,BLACK)
    d.rect(41,79,17,1,EDGE)
    d.rect(41,80,17,9,INK)
    d.label("0n26",42,82,small=True,fill=IVORY)
    d.rect(40,90,4,1,EDGE)
    d.rect(47,91,2,1,DIM)
    d.rect(51,91,2,1,DIM)
    d.rect(56,90,2,2,CYAN)


def head(d):
    # Back shell in a slight three-quarter projection.
    d.poly([(26,28),(67,28),(67,31),(76,31),(76,69),(70,69),
            (70,73),(25,73),(25,70),(20,70),(20,67),(17,67),
            (17,36),(20,36),(20,32),(26,32)], BLACK)
    d.poly([(24,33),(31,31),(31,69),(24,69),(24,66),(20,66),
            (20,37),(23,37),(23,34),(24,34)], DARK)
    d.rect(20,38,2,26,MID)
    d.rect(23,35,2,32,EDGE,.55)
    d.rect(20,38,1,15,LIT,.4)
    d.rect(25,37,2,3,INK)
    d.rect(25,43,2,3,INK)
    d.rect(25,49,2,3,INK)
    d.rect(25,55,2,3,INK)
    d.rect(25,61,2,3,INK)
    # Front shell with hard chamfers, an upper ivory glint and deep lower lip.
    d.poly([(31,26),(73,26),(73,28),(78,28),(78,31),(81,31),
            (81,68),(78,68),(78,72),(74,72),(74,75),(31,75),
            (31,73),(27,73),(27,70),(24,70),(24,32),(27,32),
            (27,29),(31,29)], BLACK)
    d.poly([(32,28),(72,28),(72,30),(77,30),(77,33),(79,33),
            (79,67),(76,67),(76,71),(72,71),(72,73),(32,73),
            (32,71),(28,71),(28,68),(26,68),(26,33),(29,33),
            (29,31),(32,31)], MID)
    d.poly([(32,29),(72,29),(72,31),(76,31),(76,33),(29,33),
            (29,32),(32,32)], EDGE)
    d.rect(34,28,23,1,IVORY,.65)
    d.rect(31,30,2,2,LIT)
    d.rect(28,34,1,28,EDGE)
    d.rect(27,35,1,24,LIT,.5)
    d.rect(78,35,1,30,DEEP)
    d.rect(76,66,2,3,DEEP)
    d.rect(31,70,43,2,DARK)
    d.rect(34,72,37,1,INK)
    d.rect(32,71,9,1,EDGE,.50)
    # Beveled black glass inset.
    d.poly([(34,33),(71,33),(71,35),(75,35),(75,38),(77,38),
            (77,63),(75,63),(75,66),(72,66),(72,68),(33,68),
            (33,66),(30,66),(30,63),(29,63),(29,38),(31,38),
            (31,35),(34,35)], BLACK)
    d.poly([(35,36),(70,36),(70,37),(73,37),(73,39),(74,39),
            (74,62),(72,62),(72,64),(69,64),(69,65),(35,65),
            (35,64),(32,64),(32,61),(31,61),(31,40),(33,40),
            (33,38),(35,38)], SCREEN)
    d.rect(36,36,33,1,DIM,.4)
    d.rect(33,39,2,4,DIM,.16)
    d.rect(35,38,11,1,CYAN,.09)
    for y in [41,45,49,53,57,61]:
        d.rect(33,y,39,1,BLACK,.13)
    d.rect(34,64,35,1,DIM,.16)
    # Status light and two miniature bezel fasteners.
    d.rect(69,69,3,1,CYAN)
    d.rect(73,69,1,1,DIM)
    d.rect(30,32,1,1,IVORY,.5)
    d.rect(76,66,1,1,IVORY,.3)


def face(d, state):
    def r(x,y,w,h,color=CYAN):
        d.rect(x,y,w,h,color)
    if state == "idle":
        d.label("0n26",34,43,scale=2)
    elif state == "blink":
        r(38,49,9,2); r(58,49,9,2)
        r(49,57,7,2); r(47,55,2,2); r(56,55,2,2)
    elif state == "happy":
        for x in (37,59):
            r(x,47,2,3); r(x+2,45,2,2); r(x+4,43,2,2)
            r(x+6,45,2,2); r(x+8,47,2,3)
        r(46,54,14,2); r(48,56,10,2); r(50,58,6,2)
        r(35,53,5,2,DIM); r(66,53,5,2,DIM)
    elif state == "curious":
        r(38,43,8,2); r(59,40,9,2)
        r(40,48,5,6); r(60,46,6,8)
        r(41,48,2,2,IVORY); r(61,46,2,2,IVORY)
        r(51,59,8,2); r(57,57,2,2)
    elif state == "surprised":
        r(39,44,6,8); r(60,44,6,8)
        r(40,44,2,2,IVORY); r(61,44,2,2,IVORY)
        r(49,55,7,2); r(47,57,2,4); r(56,57,2,4); r(49,61,7,2)
    elif state == "sleepy":
        r(37,49,9,2); r(39,51,5,1,DIM)
        r(57,49,9,2); r(59,51,5,1,DIM)
        r(50,58,6,2)
        d.label("z",65,40,small=True,fill=DIM)
    elif state == "walk":
        r(39,45,5,7); r(60,45,5,7)
        r(40,45,2,2,IVORY); r(61,45,2,2,IVORY)
        r(48,56,10,2); r(50,58,6,2)
    elif state == "wave":
        r(39,45,5,7)
        r(40,45,2,2,IVORY)
        r(58,48,2,3); r(60,46,5,2); r(65,48,2,3)
        r(47,55,2,2); r(49,57,8,2); r(57,55,2,2)


def make_robot(state):
    d = PixelDrawing()
    d.rect(34,109,31,1,INK,.12)
    d.rect(28,110,43,1,INK,.06)
    antenna(d)
    if state == "wave":
        wave_arms(d)
    elif state == "walk":
        walk_arms(d)
    else:
        neutral_arms(d)
    feet(d,state=="walk")
    body(d)
    head(d)
    face(d,state)
    return d


def load_font(size, bold=False):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono%s.ttf" % ("-Bold" if bold else ""),
        "/usr/share/fonts/truetype/liberation2/LiberationMono%s.ttf" % ("-Bold" if bold else "-Regular"),
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path,size)
    return ImageFont.load_default()


def preview(robots):
    # A review-friendly sheet, with generous whitespace and a warm paper ground.
    sheet = Image.new("RGB", (1248, 1120), IVORY)
    draw = ImageDraw.Draw(sheet)
    title = load_font(35,True)
    small = load_font(16)
    label = load_font(18,True)
    draw.text((58,42), "0n26 / LITTLE CRT", font=title, fill=INK)
    draw.text((60,96), "8 original pixel states  ·  graphite / ivory / pale cyan", font=small, fill="#566166")
    draw.line((60,135,1188,135),fill="#C9CCC6",width=1)
    cell_w, cell_h = 282, 430
    for i,(state,robot) in enumerate(robots.items()):
        x=60+(i%4)*cell_w
        y=165+(i//4)*cell_h
        draw.rectangle((x,y,x+258,y+366), fill="#E7E6DF")
        # Dark internal display ground makes transparent edges easy to review.
        sprite=robot.png(2)
        sheet.paste(sprite,(x+33,y+60),sprite)
        draw.text((x+18,y+323), f"{i+1:02d}  {state.upper()}",font=label,fill=INK)
    draw.line((60,1041,1188,1041),fill="#C9CCC6",width=1)
    draw.text((60,1064), "96 × 112 SVG  /  4× PNG  /  exact 0n26 pixel glyphs  /  permanent chest badge",font=small,fill="#566166")
    sheet.save(OUT / "emotions-preview.png")


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    robots={state:make_robot(state) for state in STATES}
    for state,robot in robots.items():
        (OUT/f"{state}.svg").write_text(robot.svg(state))
        robot.png(4).save(OUT/f"{state}.png")
    preview(robots)
    manifest={"name":"0n26 CRT robot", "design":"Original integer-grid vector artwork", "viewBox":[0,0,W,H],"svgWidth":W,"svgHeight":H,"pngWidth":W*4,"pngHeight":H*4,"preview":"emotions-preview.png","palette":{"graphite":INK,"ivory":IVORY,"cyan":CYAN},"states":{state:{"svg":f"{state}.svg","png":f"{state}.png","description":description} for state,description in STATES.items()}}
    (OUT/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    print(f"Wrote {len(robots)} SVG states, {len(robots)} transparent PNGs, and the contact sheet to {OUT}")


if __name__ == "__main__":
    main()
