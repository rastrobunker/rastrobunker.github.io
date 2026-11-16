#!/usr/bin/env python3
"""Rastro Búnker · generar_sitio.py
Correr SIEMPRE después de cambiar el catálogo (index.html) o agregar fotos:
    python3 tools/generar_sitio.py
Qué hace (se puede correr las veces que sea):
 1. Pasa las fotos base64 que haya en fotos-*.js (p. ej. las nuevas en fotos-extra.js)
    a archivos sueltos f/<id>.webp y o/<id>.jpg, y deja fotos-extra.js vacío.
 2. Regenera fotos-idx.js (id -> archivo), que es lo único que el catálogo carga al abrir.
 3. Regenera una página por pieza p/<CODIGO>.html (vista previa en WhatsApp/Google;
    a las personas las manda al catálogo en ?p=CODIGO). SIN PRECIOS: el público no ve precios.
 4. Regenera sitemap.xml y robots.txt y actualiza las versiones (?v=) en index.html.
Fotos nuevas: se pueden seguir agregando como siempre a fotos-extra.js
(RB_FOTOS({"<id>":"data:image/webp;base64,..."})) y luego correr este script.
"""
import re, json, glob, os, io, base64, hashlib, html, sys
from PIL import Image
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(R)
SITE = 'https://rastrobunker.github.io/'
WA = '50761601991'
h = open('index.html', encoding='utf-8').read()
i = h.find('const PRODUCTOS_INICIALES'); a = h.find('[', i); b = h.find('];', i)
prod = json.loads(h[a:b+1])
os.makedirs('f', exist_ok=True); os.makedirs('o', exist_ok=True); os.makedirs('p', exist_ok=True)

# 1) fotos base64 -> archivos
nuevas = 0
for fn in sorted(glob.glob('fotos-*.js')):
    if fn == 'fotos-idx.js': continue
    t = open(fn, encoding='utf-8').read()
    for m in re.finditer(r'"(\d+)":"data:image/[a-z+]+;base64,([A-Za-z0-9+/=]+)"', t):
        raw = base64.b64decode(m.group(2)); pid = m.group(1)
        im0 = Image.open(io.BytesIO(raw)); fmt = im0.format; im = im0.convert('RGB')
        if fmt != 'WEBP':
            bb = io.BytesIO(); im.save(bb, 'WEBP', quality=75); raw = bb.getvalue()
        open(f'f/{pid}.webp', 'wb').write(raw)
        j = im.copy(); j.thumbnail((640, 480)); j.save(f'o/{pid}.jpg', 'JPEG', quality=72, optimize=True)
        nuevas += 1
    if fn == 'fotos-extra.js': open(fn, 'w', encoding='utf-8').write('RB_FOTOS({});\n')
    else: os.remove(fn)
if not os.path.exists('fotos-extra.js'): open('fotos-extra.js', 'w').write('RB_FOTOS({});\n')

# 2) índice de fotos
idx = {}
for f in glob.glob('f/*.webp'):
    pid = os.path.basename(f)[:-5]
    idx[pid] = f'f/{pid}.webp?v=' + hashlib.md5(open(f, 'rb').read()).hexdigest()[:6]
idx = dict(sorted(idx.items(), key=lambda kv: int(kv[0])))
open('fotos-idx.js', 'w', encoding='utf-8').write('RB_FOTOS(' + json.dumps(idx, separators=(',', ':')) + ');\n')

# 3) páginas por pieza
COND = {'ORG': 'original', 'GEN': 'genérico', 'ORG NEW': 'original nuevo', 'ORG NUEVA': 'original nuevo',
        'GEN NEW': 'genérico nuevo', 'GEN NUEVA': 'genérico nuevo', 'NEW': 'nuevo', 'FULL ORG': 'original'}
LADO = {'RH': 'lado derecho', 'LH': 'lado izquierdo'}
UP = {'BMW', 'GAC', 'MG', 'JAC', 'GMC', 'BYD', 'DFSK', 'RAM', 'JMC', 'KIA'}
def marca(m):
    m = (m or '').strip(); return m if m.upper() in UP else m.title()
e = html.escape
vivas = set(); urls = []
for p in prod:
    cod = str(p['codigo']); vivas.add(cod + '.html')
    nombre = ' '.join(x for x in [p['categoria'], marca(p['marca']), str(p.get('modelo') or ''), str(p.get('anio') or '')] if x).strip()
    det = ', '.join(x for x in [LADO.get(p.get('lado') or ''), COND.get((p.get('condicion') or '').upper())] if x)
    vend = bool(p.get('vendido'))
    desc = f"{nombre}{(' · ' + det) if det else ''}. Código #{cod}. " + ('Pieza vendida; pregunta por otra igual. ' if vend else '') + "Rastro Búnker, autopartes de carrocería en Panamá. WhatsApp 6160-1991."
    tiene = os.path.exists(f"o/{p['id']}.jpg")
    img = SITE + (f"o/{p['id']}.jpg" if tiene else 'og.jpg')
    url = SITE + f'p/{cod}.html'
    ld = {"@context": "https://schema.org", "@type": "Product", "name": nombre, "sku": cod, "image": img, "description": desc,
          "brand": {"@type": "Brand", "name": marca(p['marca'])}}
    wa = f"https://wa.me/{WA}?text=" + __import__('urllib.parse').parse.quote(f"Hola, me interesa la pieza: {nombre} - Código #{cod} {url}")
    page = f"""<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(nombre)} · Rastro Búnker Panamá</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">{'<meta name="robots" content="noindex">' if vend else ''}
<meta property="og:type" content="product"><meta property="og:site_name" content="Rastro Búnker">
<meta property="og:title" content="{e(nombre)}"><meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}"><meta property="og:image" content="{img}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="../icon-192.png">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<script>location.replace('../?p={cod}');</script>
<style>body{{margin:0;background:#0e0e0f;color:#f2f2f2;font:16px/1.45 system-ui,sans-serif}}main{{max-width:560px;margin:0 auto;padding:16px}}img{{width:100%;border-radius:12px;background:#e9eaec}}h1{{font-size:22px;margin:14px 0 6px}}p{{color:#bbb;margin:6px 0}}a.b{{display:block;text-align:center;padding:14px;border-radius:10px;font-weight:800;text-decoration:none;margin-top:12px}}.w{{background:#1fa34a;color:#fff}}.c{{background:#e21c26;color:#fff}}</style></head>
<body><main>{f'<img src="../f/{p["id"]}.webp" alt="{e(nombre)}" width="760" height="570">' if tiene else ''}
<h1>{e(nombre)}</h1><p>{e(det)}{' · ' if det else ''}Código #{e(cod)}{' · VENDIDA' if vend else ''}</p>
<p>Rastro Búnker · autopartes de carrocería en Panamá · Lunes a sábado, 8:00 a. m. a 5:00 p. m.</p>
<a class="b c" href="../?p={cod}">Ver esta pieza en el catálogo</a>
<a class="b w" href="{e(wa)}">Consultar por WhatsApp</a></main></body></html>
"""
    open(f'p/{cod}.html', 'w', encoding='utf-8').write(page)
    if not vend: urls.append(url)
for f in os.listdir('p'):
    if f not in vivas: os.remove('p/' + f)

# 4) sitemap, robots, versiones
open('sitemap.xml', 'w', encoding='utf-8').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + f'<url><loc>{SITE}</loc></url>\n' + ''.join(f'<url><loc>{u}</loc></url>\n' for u in urls) + '</urlset>\n')
open('robots.txt', 'w').write(f'User-agent: *\nAllow: /\nDisallow: /caja.html\nDisallow: /subir.html\nSitemap: {SITE}sitemap.xml\n')
v = lambda fn: hashlib.md5(open(fn, 'rb').read()).hexdigest()[:8]
tags = (f'<script async src="fotos-idx.js?v={v("fotos-idx.js")}" onerror="rbReintentar(this)"></script>\n'
        f'<script async src="fotos-extra.js?v={v("fotos-extra.js")}" onerror="rbReintentar(this)"></script>\n')
h2, n = re.subn(r'(?:<script async src="fotos-[a-z\-]+\.js\?v=[0-9a-f]+" onerror="rbReintentar\(this\)"></script>\s*)+', lambda m: tags, h, count=1)
assert n == 1, 'no encontré las etiquetas de fotos en index.html'
h2, n = re.subn(r'window\.__rbPend=\d+;', 'window.__rbPend=2;', h2, count=1); assert n == 1
if h2 != h: open('index.html', 'w', encoding='utf-8').write(h2)
sin = [p['codigo'] for p in prod if str(p['id']) not in idx]
print(f'piezas {len(prod)} · fotos nuevas pasadas a archivo {nuevas} · fotos en total {len(idx)} · páginas {len(vivas)} · en sitemap {len(urls)}')
if sin: print('SIN FOTO:', sin[:30])
