from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1] / "assets" / "images"
for name in ("icon.png", "splash-icon.png", "favicon.png", "android-icon-foreground.png"):
    path = root / name
    with Image.open(path) as image:
        image.convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS).save(path, optimize=True)
