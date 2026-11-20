# M57 · side-by-side PR comparison per scene: full frames (scaled) on top, a 1:1 detail crop from the centre below.
import json, sys
from PIL import Image, ImageDraw, ImageFont
D = sys.argv[1] if len(sys.argv) > 1 else '/workspace/vale3d/logs/m57/pr'; OUT = sys.argv[2] if len(sys.argv) > 2 else '/workspace/vale3d/logs/m57'
try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30)
except Exception: F = ImageFont.load_default()
shots = json.load(open(D + '/shots.json'))
for sc in ['meadow', 'underbridge', 'castle']:
    ims = [(s, Image.open(s['f']).convert('RGB')) for s in shots if s['sc'] == sc]
    if not ims: continue
    W, H = ims[0][1].size; sw, sh = W // 2, H // 2; cw, ch = 500, 500; cx, cy = W // 2 - cw // 2, int(H * 0.45) - ch // 2
    pad = 50; canvas = Image.new('RGB', (len(ims) * (max(sw, cw) + 20) + 20, pad + sh + 30 + ch + 20), (20, 22, 20)); d = ImageDraw.Draw(canvas)
    for i, (s, im) in enumerate(ims):
        x = 20 + i * (max(sw, cw) + 20)
        d.text((x, 8), f"PR {s['pr']:.2f}  ({s['w']}x{s['h']} rendered)", fill=(240, 240, 220), font=F)
        canvas.paste(im.resize((sw, sh), Image.LANCZOS), (x, pad)); canvas.paste(im.crop((cx, cy, cx + cw, cy + ch)), (x, pad + sh + 30))
        d.rectangle([x + cx // 2, pad + cy // 2, x + (cx + cw) // 2, pad + (cy + ch) // 2], outline=(255, 200, 80), width=2)
    f = f'{OUT}/m57-pr-compare-{sc}.png'; canvas.save(f); print(f, canvas.size)
