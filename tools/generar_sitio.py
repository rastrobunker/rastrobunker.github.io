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
import unicodedata
def slug(m):
    t = unicodedata.normalize('NFD', (m or 'otras').strip().lower()); t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-') or 'otras'
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
<style>body{{margin:0;background:#0e0e0f;color:#f2f2f2;font:16px/1.45 system-ui,sans-serif}}main{{max-width:560px;margin:0 auto;padding:16px}}img{{width:100%;height:auto;border-radius:12px;background:#e9eaec}}h1{{font-size:22px;margin:14px 0 6px}}p{{color:#bbb;margin:6px 0}}a.b{{display:block;text-align:center;padding:14px;border-radius:10px;font-weight:800;text-decoration:none;margin-top:12px}}.w{{background:#1fa34a;color:#fff}}.c{{background:#e21c26;color:#fff}}.g{{background:#2a2a2d;color:#fff}}.v{{background:#fdecec;color:#b00020;font-weight:800;border-radius:10px;padding:10px}}.top{{display:block;font-weight:900;letter-spacing:1px;color:#fff;text-decoration:none;margin-bottom:12px}}.top b{{color:#e21c26}}p a{{color:#9cd}}</style></head>
<body><main><a class="top" href="../">RASTRO <b>BÚNKER</b></a>
{f'<img src="../f/{p["id"]}.webp" alt="{e(nombre)}" width="760" height="570">' if tiene else ''}
<h1>{e(nombre)}</h1><p>{e(det)}{' · ' if det else ''}Código #{e(cod)}</p>
<p id="vend" class="v"{'' if vend else ' hidden'}>Esta pieza ya se vendió. Escríbenos y te avisamos cuando llegue otra igual.</p>
<a class="b w" href="{e(wa)}">💬 Consultar por WhatsApp</a>
<a class="b c" href="../?p={cod}">Ver en el catálogo y piezas del mismo carro</a>
<a class="b g" href="../m/{slug(p['marca'])}.html">Más piezas para {e(marca(p['marca']))}</a>
<p>✔ Garantía de 3 días después de la entrega · Efectivo, Yappy o ACH</p>
<p>📍 Rastro Búnker · autopartes de carrocería en Panamá · Lunes a sábado, 8:00 a. m. a 5:00 p. m. · <a href="https://waze.com/ul?ll=8.9644588,-79.5401215&navigate=yes">Waze</a></p>
<script>fetch('https://firestore.googleapis.com/v1/projects/rastrobunker-caja/databases/(default)/documents/vendidos/{cod}?key=AIzaSyDmVL8mLvzjWr69Ab-s8Lf0A-H_JtWaTXk').then(r=>r.ok?r.json():null).then(j=>{{if(!j||!j.fields)return;var u=j.fields.unidades||{{}};if(+(u.integerValue||u.doubleValue||0)>={p.get('cantidad') or 1})document.getElementById('vend').hidden=false}}).catch(function(){{}});</script>
</main></body></html>
"""
    open(f'p/{cod}.html', 'w', encoding='utf-8').write(page)
    if not vend: urls.append(url)
for f in os.listdir('p'):
    if f not in vivas: os.remove('p/' + f)

# 3b) páginas por marca (m/<marca>.html) para Google y enlaces en el pie del catálogo
os.makedirs('m', exist_ok=True)
import collections
pm = collections.defaultdict(list)
for p in prod:
    if not p.get('vendido') and (p.get('marca') or '').strip(): pm[p['marca'].strip().upper()].append(p)
murls = []; mvivas = set()
CSSM = "body{margin:0;background:#0e0e0f;color:#f2f2f2;font:15px/1.4 system-ui,sans-serif}main{max-width:980px;margin:0 auto;padding:16px}a{color:inherit;text-decoration:none}h1{font-size:22px}h2{font-size:17px;margin:22px 0 8px;color:#ff5a5f}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.g a{background:#1c1c1e;border-radius:10px;overflow:hidden;display:block}.g img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;background:#e9eaec}.g span{display:block;padding:8px;font-size:13px}.top{font-weight:900;letter-spacing:1px}.top b{color:#e21c26}.w{display:inline-block;background:#1fa34a;color:#fff;font-weight:800;border-radius:10px;padding:12px 16px;margin:8px 0}.mm a{display:inline-block;margin:0 10px 8px 0;color:#9cd}"
for mk_, L in sorted(pm.items()):
    sl = slug(mk_); mvivas.add(sl + '.html'); nm = marca(mk_)
    cats = collections.defaultdict(list)
    for p in L: cats[p['categoria']].append(p)
    desc = f"{len(L)} piezas de carrocería para {nm} en Panamá: " + ', '.join(f"{c.lower()} ({len(v)})" for c, v in sorted(cats.items(), key=lambda x: -len(x[1]))[:6]) + ". Rastro Búnker · WhatsApp 6160-1991."
    body = ''
    for c, v in sorted(cats.items(), key=lambda x: -len(x[1])):
        body += f'<h2>{e(c)} para {e(nm)} ({len(v)})</h2><div class="g">' + ''.join(
            f'<a href="../p/{p["codigo"]}.html">' + (f'<img loading="lazy" src="../o/{p["id"]}.jpg" alt="{e(c)} {e(nm)} {e(str(p.get("modelo") or ""))} {e(str(p.get("anio") or ""))}">' if os.path.exists(f'o/{p["id"]}.jpg') else '') +
            f'<span>{e(str(p.get("modelo") or ""))} {e(str(p.get("anio") or ""))}<br><small>#{e(str(p["codigo"]))}</small></span></a>' for p in v) + '</div>'
    url = SITE + f'm/{sl}.html'; murls.append(url)
    open(f'm/{sl}.html', 'w', encoding='utf-8').write(f"""<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Piezas de carrocería para {e(nm)} en Panamá · Rastro Búnker</title><meta name="description" content="{e(desc)}"><link rel="canonical" href="{url}">
<meta property="og:title" content="Piezas para {e(nm)} en Panamá · Rastro Búnker"><meta property="og:description" content="{e(desc)}"><meta property="og:image" content="{SITE}og.jpg"><link rel="icon" href="../icon-192.png">
<style>{CSSM}</style></head><body><main><a class="top" href="../">RASTRO <b>BÚNKER</b></a>
<h1>Piezas de carrocería para {e(nm)} en Panamá</h1><p>{len(L)} piezas disponibles con foto real: faros, defensas, parrillas, capós, guardafangos y más. Garantía de 3 días · Efectivo, Yappy o ACH · Lunes a sábado, 8:00 a. m. a 5:00 p. m.</p>
<a class="w" href="https://wa.me/{WA}?text={__import__('urllib.parse').parse.quote('Hola, busco una pieza para ' + nm)}">💬 Pregunta por tu pieza para {e(nm)}</a>
{body}
<h2>Otras marcas</h2><p class="mm">{''.join(f'<a href="{slug(k)}.html">{e(marca(k))}</a>' for k in sorted(pm) if k != mk_)}</p></main></body></html>
""")
for f in os.listdir('m'):
    if f not in mvivas: os.remove('m/' + f)
urls = murls + urls
pie = '<!--RB-MARCAS--><nav class="rb-pie-marcas" aria-label="Piezas por marca"><b>Piezas por marca:</b> ' + ' · '.join(f'<a href="m/{slug(k)}.html">{e(marca(k))}</a>' for k in sorted(pm, key=lambda k: -len(pm[k]))) + '</nav><!--/RB-MARCAS-->'
if '<!--RB-MARCAS-->' in h: h = re.sub(r'<!--RB-MARCAS-->.*?<!--/RB-MARCAS-->', lambda m_: pie, h, flags=re.S)
else:
    ancla = '<div class="footer-note">'; assert h.count(ancla) == 1
    h = h.replace(ancla, pie + '\n  ' + ancla)
    h = h.replace('<style id="rb-mejoras-css">', '<style id="rb-mejoras-css">\n.rb-pie-marcas{max-width:900px;margin:18px auto 0;padding:0 14px;font-size:12.5px;line-height:1.9;text-align:center;opacity:.8}.rb-pie-marcas a{color:inherit}', 1)
open('index.html', 'w', encoding='utf-8').write(h)

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
