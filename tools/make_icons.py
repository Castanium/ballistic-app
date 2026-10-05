"""Detoure le logo (fond gris peu sature) et genere les icones PWA.
Usage : uv run --no-project --with pillow python tools/make_icons.py"""
from PIL import Image, ImageFilter
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = Image.open(os.path.join(ROOT, "logo propre sans bordure.jpg")).convert("RGB")
# masque = saturation (max-min) : le fond est gris neutre, le logo est jaune/orange/rouge
px = src.load()
w, h = src.size
mask = Image.new("L", (w, h))
mp = mask.load()
for y in range(h):
    for x in range(w):
        R, G, B = px[x, y]
        s = max(R, G, B) - min(R, G, B)
        mp[x, y] = 0 if s < 45 else (255 if s > 85 else int((s - 45) * 255 / 40))
mask = mask.filter(ImageFilter.MedianFilter(3))
logo = src.copy(); logo.putalpha(mask)
logo = logo.crop(mask.getbbox())
logo.thumbnail((900, 900), Image.LANCZOS)
logo.save(os.path.join(ROOT, "icons", "logo.png"), optimize=True)
print("logo", logo.size)
BG = (12, 14, 17, 255)
def icon(size, pad, name):
    im = Image.new("RGBA", (size, size), BG)
    l = logo.copy(); l.thumbnail((int(size * (1 - 2 * pad)),) * 2, Image.LANCZOS)
    im.alpha_composite(l, ((size - l.width) // 2, (size - l.height) // 2))
    im.convert("RGB").save(os.path.join(ROOT, "icons", name), optimize=True)
icon(192, .10, "icon-192.png"); icon(512, .10, "icon-512.png")
icon(512, .20, "maskable-512.png"); icon(180, .10, "apple-touch-icon.png")
