#!/usr/bin/env python3
"""Genera el ícono de lanzador y el splash de Android desde el logotipo oficial.

Fuente de la marca (no se recrea con dibujos propios):
  - www/assets/logo/metria-logo-principal.png  (color, fondo oscuro)
  - www/assets/logo/metria-logo-blanco.png     (silueta para iconos tematizados)

Salidas:
  - mipmap-*/ic_launcher.png y ic_launcher_round.png (Android 7–7.1)
  - mipmap-*/ic_launcher_foreground.png (adaptive icon, 108 dp)
  - mipmap-*/ic_launcher_monochrome.png (iconos tematizados de Android 13+)
  - drawable-nodpi/splash_logo.png (solo el símbolo, sin wordmark)
  - resources-icon.png (1024 px, ficha de tienda)

Uso: python3 scripts/generate-icons.py
"""

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android" / "app" / "src" / "main" / "res"
LOGO_DIR = ROOT / "www" / "assets" / "logo"

# Valores de design-tokens.css (tema oscuro). El ícono no cambia con el tema.
BG = "#08080D"

# Zona segura del adaptive icon: 66 dp de diámetro sobre un lienzo de 108 dp.
# El símbolo mide 50 dp de ancho, de modo que su punto más lejano al centro
# queda dentro de esos 66 dp y ningún recorte del lanzador lo corta.
ADAPTIVE_CONTENT = 50 / 108
# En los iconos legacy no hay sangrado: el símbolo ocupa ~62 % del lienzo.
LEGACY_CONTENT = 0.62
ROUND_CONTENT = 0.58
# Splash: solo el símbolo, centrado.
SPLASH_CONTENT = 0.56


def load_symbol(path):
    """Carga el PNG oficial y recorta el margen transparente del lienzo."""
    image = Image.open(path).convert("RGBA")
    bbox = image.split()[3].getbbox()
    if bbox is None:
        raise SystemExit(f"El logotipo no tiene píxeles visibles: {path}")
    return image.crop(bbox)


COLOR_SYMBOL = load_symbol(LOGO_DIR / "metria-logo-principal.png")
MONO_SYMBOL = load_symbol(LOGO_DIR / "metria-logo-blanco.png")


def place_symbol(canvas, content_width, symbol=COLOR_SYMBOL):
    """Centra el símbolo en el lienzo con el ancho visible indicado."""
    width = max(1, round(content_width))
    height = max(1, round(width * symbol.height / symbol.width))
    scaled = symbol.resize((width, height), Image.LANCZOS)
    x = (canvas.width - width) // 2
    y = (canvas.height - height) // 2
    canvas.alpha_composite(scaled, (x, y))
    return canvas


def _save(img, path, size):
    img.resize((size, size), Image.LANCZOS).save(path)
    print(f"  {path.relative_to(ROOT)} {size}x{size}")


def full_icon(size, shape="rounded"):
    """Icono legacy con fondo horneado; el lanzador lo recorta si hace falta."""
    factor = 4 if size <= 512 else 2
    canvas_size = size * factor
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if shape == "circle":
        draw.ellipse([0, 0, canvas_size - 1, canvas_size - 1], fill=BG)
        content = canvas_size * ROUND_CONTENT
    else:
        draw.rounded_rectangle(
            [0, 0, canvas_size - 1, canvas_size - 1],
            radius=int(canvas_size * 0.225),
            fill=BG,
        )
        content = canvas_size * LEGACY_CONTENT

    place_symbol(img, content)
    return img.resize((size, size), Image.LANCZOS)


def adaptive_foreground(size, symbol=COLOR_SYMBOL):
    """Primer plano transparente del adaptive icon."""
    factor = 4 if size <= 432 else 2
    canvas_size = size * factor
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    place_symbol(img, canvas_size * ADAPTIVE_CONTENT, symbol)
    return img.resize((size, size), Image.LANCZOS)


def splash_logo(size=1024):
    """Solo el símbolo sobre fondo transparente.

    El fondo lo pone splash.xml con el color de tema; así no hay un cuadrado
    oscuro visible sobre el fondo de arranque.
    """
    factor = 2
    canvas_size = size * factor
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    place_symbol(img, canvas_size * SPLASH_CONTENT)
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
        _save(adaptive_foreground(size), folder / "ic_launcher_foreground.png", size)
        _save(
            adaptive_foreground(size, MONO_SYMBOL),
            folder / "ic_launcher_monochrome.png",
            size,
        )

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
