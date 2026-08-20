from pathlib import Path
from PIL import Image

source = Path('/home/ubuntu/webdev-static-assets/cad-ai-icon.png')
project = Path('/home/ubuntu/cad-ai-requirements-agent/assets/images')
image = Image.open(source).convert('RGB')
for name, size in {
    'icon.png': 768,
    'splash-icon.png': 512,
    'favicon.png': 128,
    'android-icon-foreground.png': 432,
}.items():
    output = image.resize((size, size), Image.Resampling.LANCZOS)
    output.save(project / name, format='PNG', optimize=True, compress_level=9)
