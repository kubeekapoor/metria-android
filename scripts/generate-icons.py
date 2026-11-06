#!/usr/bin/env python3
"""Genera el ícono y las pantallas de inicio de Metría.

La marca es un monograma M plegado, inspirado en el logo base y en la
referencia visual: paneles sólidos en azul, sin degradados, sobre fondo oscuro.
Los PNG se generan con remuestreo para que los bordes queden suaves.

Uso: python3 scripts/generate-icons.py
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android" / "app" / "src" / "main" / "res"
FONT_BOLD = "/usr/share/fonts/truetype/inter-zorin-os/Inter-Bold.ttf"
FONT_REGULAR = "/usr/share/fonts/truetype/inter-zorin-os/Inter-Regular.ttf"

BG = "#0A0A12"
INK = "#F4F5F9"
DIM = "#707585"
MARK = [
    ([(0, 12), (14, 4), (14, 92), (0, 100)], "#2F49D1"),
    ([(14, 4), (50, 44), (50, 56), (14, 16)], "#5B7CFF"),
    ([(50, 44), (86, 4), (86, 16), (50, 56)], "#4463F5"),
    ([(86, 4), (100, 12), (100, 100), (86, 92)], "#2A3FB8"),
]


def _draw_mark(draw, box, scale):
    """Dibuja el monograma dentro de box=(x, y, ancho, alto)."""
    x, y, w, h = box

    def point(px, py):
        return ((x + px / 100 * w) * scale, (y + py / 100 * h) * scale)

    for points, color in MARK:
        draw.polygon([point(px, py) for px, py in points], fill=color)


def _save(img, path, size):
    img.resize((size, size), Image.LANCZOS).save(path)
    print(f"  {path.relative_to(ROOT)} {size}x{size}")


def full_icon(size, shape="rounded"):
    factor = 4 if size <= 512 else 2
    canvas = size * factor
    img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if shape == "circle":
        draw.ellipse([0, 0, canvas - 1, canvas - 1], fill=BG)
    else:
        draw.rounded_rectangle(
            [0, 0, canvas - 1, canvas - 1],
            radius=int(canvas * 0.225),
            fill=BG,
        )

    mark = canvas * 0.51
    _draw_mark(draw, ((canvas - mark) / 2, (canvas - mark) / 2, mark, mark), 1)
    return img.resize((size, size), Image.LANCZOS)


def foreground(size):
    factor = 4 if size <= 432 else 2
    canvas = size * factor
    img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Zona segura del ícono adaptativo: la marca ocupa ~54 % del lienzo.
    mark = canvas * 0.54
    _draw_mark(draw, ((canvas - mark) / 2, (canvas - mark) / 2, mark, mark), 1)
    return img.resize((size, size), Image.LANCZOS)


def tracked_text(draw, xy, text, font, fill, tracking):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking


def splash_logo(size=1024):
    """Marca + nombre + lema sobre fondo transparente.

    Se dibuja como un cuadrado y se centra desde Android con un layer-list,
    así el logo no se deforma en pantallas de distinta proporción.
    """
    factor = 2
    canvas = size * factor
    img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    mark = canvas * 0.30
    _draw_mark(draw, ((canvas - mark) / 2, canvas * 0.22, mark, mark), 1)

    word_font = ImageFont.truetype(FONT_BOLD, int(canvas * 0.115))
    word = "Metría"
    word_w = draw.textlength(word, font=word_font)
    draw.text(((canvas - word_w) / 2, canvas * 0.555), word, font=word_font, fill=INK)

    tag_font = ImageFont.truetype(FONT_REGULAR, int(canvas * 0.028))
    tag = "TUS FINANZAS, EN ORDEN"
    tracking = canvas * 0.007
    tag_w = sum(draw.textlength(ch, font=tag_font) for ch in tag) + (len(tag) - 1) * tracking
    tracked_text(
        draw,
        ((canvas - tag_w) / 2, canvas * 0.705),
        tag,
        tag_font,
        DIM,
        tracking,
    )

    return img.resize((size, size), Image.LANCZOS)


def main():
    print("Íconos de Android:")
    legacy = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    fg = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}

    for density, size in legacy.items():
        folder = RES / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        _save(full_icon(size), folder / "ic_launcher.png", size)
        _save(full_icon(size, "circle"), folder / "ic_launcher_round.png", size)

    for density, size in fg.items():
        folder = RES / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        _save(foreground(size), folder / "ic_launcher_foreground.png", size)

    print("Icono de recursos:")
    _save(full_icon(1024), ROOT / "resources-icon.png", 1024)

    print("Pantalla de inicio:")
    splash_dir = RES / "drawable-nodpi"
    splash_dir.mkdir(parents=True, exist_ok=True)
    splash_img = splash_logo()
    splash_path = splash_dir / "splash_logo.png"
    splash_img.save(splash_path)
    print(f"  {splash_path.relative_to(ROOT)} {splash_img.width}x{splash_img.height}")


if __name__ == "__main__":
    main()
