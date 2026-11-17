#!/usr/bin/env python3
"""Rastro Búnker · generar_sitio.py
Correr SIEMPRE después de cambiar el catálogo (index.html) o agregar fotos:
    python3 tools/generar_sitio.py
Qué hace (se puede correr las veces que sea):
 1. Pasa las fotos base64 que haya en fotos-*.js (p. ej. las nuevas en fotos-extra.js)
    a archivos sueltos f/<id>.webp y o/<id>.jpg, y deja fotos-extra.js vacío.
 2. Regenera fotos-idx.js (id -> archivo), que es lo único que el catálogo carga al abrir.
 3. Regenera las páginas para Google, todas con el diseño de inicio.html y SIN PRECIOS:
    p/<CODIGO>.html (por pieza), m/<marca>.html, mo/<marca>-<modelo>.html (modelos con 3+ piezas)
    y c/<tipo>.html (por tipo de pieza). El estilo común está en paginas.css (lo escribe este script).
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

# 0) copia de piezas vendidas (vendidos.json): el catálogo la usa para no gastar lecturas de Firebase
def copia_vendidos():
    import urllib.request, urllib.parse, time
    base = 'https://firestore.googleapis.com/v1/projects/rastrobunker-caja/databases/(default)/documents/vendidos?pageSize=300&key=AIzaSyDmVL8mLvzjWr69Ab-s8Lf0A-H_JtWaTXk'
    d, tok = {}, ''
    while True:
        j = json.load(urllib.request.urlopen(base + ('&pageToken=' + urllib.parse.quote(tok) if tok else ''), timeout=30))
        for doc in j.get('documents', []):
            f = doc.get('fields', {}); c = f.get('codigo', {}).get('stringValue')
            u = f.get('unidades', {}); n = int(float(u.get('integerValue', u.get('doubleValue', 0)) or 0))
            if c: d[c] = n
        tok = j.get('nextPageToken', '')
        if not tok: break
    cods = sorted(d); paso = max(1, -(-len(cods) // 8))
    cortes = [cods[i] for i in range(paso, len(cods), paso)]
    json.dump({'t': int(time.time() * 1000), 'n': len(d), 's': sum(d.values()), 'c': cortes, 'd': {c: d[c] for c in cods}},
              open('vendidos.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    return len(d), sum(d.values())
try:
    print('vendidos.json: %d códigos, %d unidades' % copia_vendidos())
except Exception as e:
    print('AVISO: no se pudo actualizar vendidos.json (%s); se deja la copia anterior' % e)

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

# 3) páginas para Google: por pieza (p/), por marca (m/), por modelo (mo/) y por tipo de pieza (c/)
#    Todas con el mismo diseño que inicio.html (barra carbón, fondo papel, cinta amarilla con el código).
#    SIN PRECIOS. Las piezas vendidas no salen en las listas.
import unicodedata, collections, urllib.parse, shutil
COND = {'ORG': 'original', 'GEN': 'genérico', 'ORG NEW': 'original nuevo', 'ORG NUEVA': 'original nuevo',
        'GEN NEW': 'genérico nuevo', 'GEN NUEVA': 'genérico nuevo', 'NEW': 'nuevo', 'FULL ORG': 'original'}
LADO = {'RH': 'lado derecho', 'LH': 'lado izquierdo'}
UP = {'BMW', 'GAC', 'MG', 'JAC', 'GMC', 'BYD', 'DFSK', 'RAM', 'JMC', 'KIA'}
MAPS = 'https://www.google.com/maps/search/?api=1&query=8.9644588,-79.5401215&query_place_id=ChIJ69qTipKprI8R8RCLV_wTA90'
RESENA = 'https://search.google.com/local/writereview?placeid=ChIJ69qTipKprI8R8RCLV_wTA90'
WAZE = 'https://waze.com/ul?ll=8.9644588,-79.5401215&navigate=yes'
e = html.escape
q = urllib.parse.quote
def marca(m):
    m = (m or '').strip(); return m.upper() if m.upper() in UP else m.title()
def slug(m):
    t = unicodedata.normalize('NFD', (m or 'otras').strip().lower()); t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-') or 'otras'
SIGLAS = {'HB', 'GT', 'ASX', 'LED', 'SW4', 'GLI', 'GTI', 'EVO', 'DX', 'LX', 'EX', 'SE', 'XL', 'XLT', 'RS', 'ST', 'HRV', 'CRV', 'BRV', 'WRV', 'ZS', 'HS', 'RX', 'NX', 'UX', 'LS', 'GS', 'IS', 'ES', 'QX', 'JS', 'TXL', 'VX', 'GX', 'LC', 'GLE', 'GLA', 'GLC', 'GLB', 'GLS', 'APV', 'NPR'}
FIJOS = {'4RUNNER': '4Runner', 'X-TRAIL': 'X-Trail', 'D-MAX': 'D-Max', 'ECOSPORT': 'EcoSport', 'F-150': 'F-150'}
def modelo(t):
    """Nombre del modelo para mostrar: RAV4, CX-5, NKR y siglas en mayúscula; i10 e ix35 en minúscula; el resto con inicial mayúscula."""
    out = []
    for w in re.sub(r'\s+', ' ', str(t or '').strip()).split(' '):
        u = w.upper()
        if u in FIJOS: w = FIJOS[u]
        elif re.fullmatch(r'IX?\d+', u): w = u.lower()
        elif any(c.isdigit() for c in w) or u in SIGLAS: w = u
        elif w.isalpha() and len(w) <= 4 and not re.search(r'[AEIOUÁÉÍÓÚ]', u): w = u
        elif w.isupper() or w.islower(): w = '-'.join(x.capitalize() if len(x) > 2 else x.upper() for x in w.split('-'))
        out.append(w)
    return ' '.join(out)
def clave(t):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFD', str(t or '').upper()).encode('ascii', 'ignore').decode()).strip()
PLURAL = {'Parrilla': 'Parrillas', 'Lámpara Delantera': 'Faros y lámparas delanteras', 'Lámpara Trasera': 'Lámparas traseras', 'Defensa Trasera': 'Defensas traseras',
          'Defensa Delantera': 'Defensas delanteras', 'Flare': 'Flares', 'Cover de Alógena': 'Covers de halógena', 'Guardafango': 'Guardafangos',
          'Halógenas / Faros antiniebla': 'Halógenas y faros antiniebla', 'Puerta': 'Puertas', 'Vidrio': 'Vidrios', 'Cubrepolvo': 'Cubrepolvos', 'Refuerzo Delantero': 'Refuerzos delanteros',
          'Capó': 'Capós', 'Marco de Radiador': 'Marcos de radiador', 'Retrovisor': 'Retrovisores', 'Tapa de Baúl': 'Tapas de baúl', 'Estribo': 'Estribos y rolling boards',
          'Defensa Delantera Inferior': 'Defensas delanteras inferiores', 'Defensa Trasera Inferior': 'Defensas traseras inferiores', 'Tapa Superior de Radiador': 'Tapas superiores de radiador',
          'Refuerzo Trasero': 'Refuerzos traseros', 'Copa': 'Copas', 'Moldura Trasera': 'Molduras traseras', 'Extensión de Defensa Trasera': 'Extensiones de defensa trasera',
          'Protector Inferior': 'Protectores inferiores', 'Ventilador': 'Ventiladores', 'Depósito de Agua': 'Depósitos de agua', 'Extensión de Defensa Delantera': 'Extensiones de defensa delantera',
          'Accesorio Nuevo': 'Accesorios nuevos', 'Soporte de Defensa': 'Soportes de defensa'}
def plural(c): return PLURAL.get(c, c)
def mkey(m): return clave(m).replace('-', ' ')

try: V = json.load(open('vendidos.json', encoding='utf-8'))['d']
except Exception: V = {}
def vendida(p): return bool(p.get('vendido')) or V.get(str(p['codigo']), 0) >= (p.get('cantidad') or 1)
disp = [p for p in prod if not vendida(p) and (p.get('marca') or '').strip()]
def nombre_de(p):
    return ' '.join(x for x in [p['categoria'], marca(p['marca']), modelo(p.get('modelo')), str(p.get('anio') or '')] if x).strip()

# --- modelos: una pieza "Hilux / Fortuner" o "Hilux Revo" sale en la página de Hilux (y en la de Fortuner) ---
ALIAS = [(r'\b(CR|HR|BR|WR)V\b', r'\1-V'), (r'\bCX(\d+)\b', r'CX-\1'), (r'\bXTRAIL\b', 'X-TRAIL'), (r'\bTCROSS\b', 'T-CROSS'), (r'\bDMAX\b', 'D-MAX')]
def kmod(x, mk, f=clave):
    """Clave de un modelo: junta CRV con CR-V, CX5 con CX-5, y quita la marca repetida (Mazda 'Mazda 3')."""
    x = f(x)
    for a_, b_ in ALIAS: x = re.sub(a_, b_, x)
    if clave(x).startswith(mk + ' '): x = x[len(mk) + 1:]
    return x
def partes(p):
    t = re.sub(r'\([^)]*\)', ' ', str(p.get('modelo') or '')); mk = mkey(p['marca'])
    return [kmod(x, mk) for x in t.split('/') if kmod(x, mk)]
bases = collections.Counter()
for p in disp:
    for x in set(partes(p)): bases[(mkey(p['marca']), x)] += 1
pmod = collections.defaultdict(list)
for p in disp:
    mk = mkey(p['marca']); ya = set()
    for x in partes(p):
        for (bm, b) in bases:
            if bm == mk and (x == b or x.startswith(b + ' ')) and b not in ya: ya.add(b); pmod[(mk, b)].append(p)
MIN_MODELO = 3
pmod = {k: v for k, v in pmod.items() if len(v) >= MIN_MODELO and not k[1].startswith('TAPA DE RIN') and k[0] != 'UNIVERSAL'}
def nmodelo(k):
    con = lambda x: re.sub(r'\s+', ' ', str(x).upper()).strip()   # como clave() pero conserva las tildes
    orig = collections.Counter(kmod(x, k[0], con) for p in pmod[k] for x in re.sub(r'\([^)]*\)', ' ', str(p.get('modelo') or '')).split('/') if kmod(x, k[0]) == k[1])
    return modelo(orig.most_common(1)[0][0] if orig else k[1])
def smodelo(k): return slug(k[0]) + '-' + slug(k[1])
def modelo_de(p):
    """La página de modelo más específica que tiene esta pieza (para el enlace desde su ficha)."""
    mk = mkey(p['marca']); c = [k for k in pmod if k[0] == mk and p in pmod[k]]
    return max(c, key=lambda k: len(k[1])) if c else None
pm = collections.defaultdict(list); pc = collections.defaultdict(list)
for p in disp: pm[mkey(p['marca'])].append(p); pc[p['categoria']].append(p)
nmarca = {k: marca(v[0]['marca']) for k, v in pm.items()}
nmarca.update({k: v for k, v in {'MERCEDES BENZ': 'Mercedes-Benz', 'MINI': 'Mini'}.items() if k in nmarca})
N_RED = f'{(len(disp) // 100) * 100:,}'

CSS = """:root{--carbon:#17171A;--papel:#F6F5F2;--tarjeta:#FFF;--tinta:#1C1C1E;--gris:#6B665E;--linea:#E2E0DB;--rojo:#D7192D;--cinta:#F2D43D;--wa:#1A9A46;--titulo:"Anton","Arial Narrow",Impact,sans-serif;--texto:"Barlow","Segoe UI",Tahoma,sans-serif;--marcador:"Permanent Marker","Comic Sans MS",cursive;color-scheme:light}
*{box-sizing:border-box}body{margin:0;background:var(--papel);color:var(--tinta);font:400 16px/1.5 var(--texto);-webkit-font-smoothing:antialiased}
img{max-width:100%;height:auto;display:block}a{color:inherit}:focus-visible{outline:3px solid var(--cinta);outline-offset:2px}
.w{max-width:1080px;margin:0 auto;padding:0 16px}
h1,h2{font-family:var(--titulo);font-weight:400;text-transform:uppercase;letter-spacing:.01em;line-height:1.05;margin:0;text-wrap:balance}
h1{font-size:clamp(28px,6vw,42px)}h2{font-size:clamp(21px,4.2vw,27px);margin:34px 0 4px}h2 small{font:600 15px var(--texto);color:var(--gris);text-transform:none;letter-spacing:0}
p{margin:0}.sub{color:var(--gris);max-width:68ch;margin-top:10px}
.btn{white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 20px;border-radius:10px;font:700 16px var(--texto);text-decoration:none;border:2px solid transparent}
.btn.rojo{background:var(--rojo);color:#fff}.btn.wa{background:var(--wa);color:#fff}.btn.linea{border-color:var(--tinta)}.btns{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.barra{background:var(--carbon);color:#fff;position:sticky;top:0;z-index:20;border-bottom:1px solid #2B2B30}
.barra .w{display:flex;align-items:center;gap:14px;min-height:58px}
.marca{white-space:nowrap;display:flex;align-items:center;gap:9px;text-decoration:none;font:400 21px var(--titulo);letter-spacing:.03em;margin-right:auto}
.marca img{width:36px;height:36px}.marca b{color:var(--rojo);font-weight:400}
.barra nav{display:flex;gap:18px}.barra nav a{font:600 15px var(--texto);text-decoration:none;opacity:.85}.barra .btn{min-height:40px;padding:0 14px;font-size:15px}
.cab{background:var(--tarjeta);border-bottom:1px solid var(--linea);padding:22px 0 26px}
.miga{font-size:14px;color:var(--gris);margin-bottom:10px;display:flex;flex-wrap:wrap;gap:6px}.miga a{text-decoration:none;font-weight:600;color:var(--tinta)}.miga span::before{content:"›";margin-right:6px}
.conf{list-style:none;margin:16px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px 18px;font-size:14.5px;color:var(--gris)}.conf b{color:var(--tinta)}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.chips a{background:var(--tarjeta);border:1px solid var(--linea);border-radius:999px;padding:7px 13px;text-decoration:none;font-weight:700;font-size:14.5px}.chips small{font-weight:600;color:var(--gris);margin-left:3px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-top:12px}
.pz{background:var(--tarjeta);border:1px solid var(--linea);border-radius:10px;overflow:hidden;text-decoration:none;display:block;position:relative}
.pz img{width:100%;aspect-ratio:4/3;object-fit:cover;background:#E9EAEC}
.pz b{display:block;padding:9px 11px 0;font-size:15px;line-height:1.25}.pz span{display:block;padding:1px 11px 11px;font-size:13.5px;color:var(--gris)}
.cinta{font:400 13px/1.15 var(--marcador);background:var(--cinta);color:#151515;padding:4px 8px 3px;display:inline-block;box-shadow:0 1px 2px rgba(0,0,0,.25)}
.pz .cinta{position:absolute;left:8px;top:8px;transform:rotate(-2deg)}
main{padding-bottom:46px}
.ficha{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:28px;align-items:start;margin-top:22px}
.ficha .foto{background:var(--tarjeta);border:1px solid var(--linea);border-radius:12px;overflow:hidden;position:relative}.ficha .foto img{width:100%}
.ficha .foto .cinta{position:absolute;left:12px;top:12px;font-size:17px;transform:rotate(-2deg)}
.dl{margin:14px 0 0;display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:15.5px}.dl dt{color:var(--gris)}.dl dd{margin:0;font-weight:600}
.ficha .btn{width:100%;margin-top:10px}.aviso{background:#FDECEC;color:#9B1020;font-weight:700;border-radius:10px;padding:11px 13px;margin-top:14px}
.nota{margin-top:14px;font-size:14.5px;color:var(--gris)}
footer{background:var(--carbon);color:#C9C6BF;padding:30px 0 40px;font-size:15px}footer .w{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
footer b{color:#fff;display:block;margin-bottom:6px}footer a{display:block;text-decoration:none;padding:3px 0}
@media(max-width:720px){.barra nav{display:none}footer .w{grid-template-columns:1fr}.ficha{grid-template-columns:1fr;gap:16px}.g{grid-template-columns:1fr 1fr;gap:10px}.marca{font-size:18px;gap:7px}.marca img{width:32px;height:32px}.barra .btn{padding:0 12px}}"""
open('paginas.css', 'w', encoding='utf-8').write(CSS)
VCSS = hashlib.md5(CSS.encode()).hexdigest()[:8]
FUENTES = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow:wght@400;500;600;700&family=Permanent+Marker&display=swap" rel="stylesheet">'
PIE = f'''<footer><div class="w">
<div><b>Rastro Búnker</b>Piezas de carrocería nuevas y usadas.<br>Calidonia, ciudad de Panamá.<br>Lunes a sábado, 8:00 a. m. a 5:00 p. m.</div>
<div><b>Contacto</b><a href="https://wa.me/{WA}">WhatsApp 6160-1991</a><a href="tel:+{WA}">Llamar al 6160-1991</a><a href="{WAZE}">Llegar con Waze</a><a href="{MAPS}">Ver en Google Maps</a></div>
<div><b>Síguenos</b><a href="https://www.instagram.com/rastrobunker">Instagram @rastrobunker</a><a href="https://www.tiktok.com/@autopartes.bunker">TikTok @autopartes.bunker</a><a href="{RESENA}">Déjanos tu reseña en Google</a></div>
</div></footer>'''
def pagina(ruta, titulo, desc, miga, cuerpo, img=None, tipo='website', ld=None, noindex=False):
    """miga: [(texto, href o None)] desde Inicio; el último es la página actual."""
    url = SITE + ruta
    migas = [('Inicio', '../inicio.html')] + miga
    bc = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": n, "name": t, "item": (SITE + hr.replace('../', '')) if hr else url} for n, (t, hr) in enumerate(migas, 1)]}
    lds = ''.join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' for x in ([bc] + ([ld] if ld else [])))
    nav = '<nav class="miga" aria-label="Estás en">' + ''.join((f'<a href="{hr}">{e(t)}</a>' if n == 0 else f'<span><a href="{hr}">{e(t)}</a></span>') if hr else f'<span>{e(t)}</span>' for n, (t, hr) in enumerate(migas)) + '</nav>'
    open(ruta, 'w', encoding='utf-8').write(f'''<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(titulo)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">{'<meta name="robots" content="noindex">' if noindex else ''}
<meta property="og:type" content="{tipo}"><meta property="og:site_name" content="Rastro Búnker"><meta property="og:title" content="{e(titulo)}"><meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}"><meta property="og:image" content="{img or SITE + 'og.jpg'}"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#17171A"><link rel="icon" href="../icon-192.png">{FUENTES}
<link rel="stylesheet" href="../paginas.css?v={VCSS}">{lds}</head>
<body><header class="barra"><div class="w"><a class="marca" href="../inicio.html"><img src="../icon-192.png" alt="" width="36" height="36"><span>RASTRO <b>BÚNKER</b></span></a>
<nav aria-label="Secciones"><a href="../inicio.html#llegar">Cómo llegar</a><a href="https://wa.me/{WA}?text={q('Hola, busco una pieza para mi carro')}">WhatsApp</a></nav>
<a class="btn rojo" href="../">Ver catálogo</a></div></header>
<main>{cuerpo.replace('@@MIGA@@', nav)}</main>
{PIE}</body></html>
''')
    return url
def tarjeta(p, titulo, sub):
    f = f'o/{p["id"]}.jpg'
    im = f'<img loading="lazy" src="../{f}" alt="{e(nombre_de(p))}" width="640" height="480">' if os.path.exists(f) else ''
    return f'<a class="pz" href="../p/{e(str(p["codigo"]))}.html">{im}<i class="cinta">{e(str(p["codigo"]))}</i><b>{e(titulo)}</b><span>{e(sub)}</span></a>'
def detalle(p):
    return ' · '.join(x for x in [str(p.get('anio') or ''), LADO.get(p.get('lado') or '', ''), COND.get((p.get('condicion') or '').upper(), '')] if x)
CONF = '<ul class="conf"><li><b>Garantía de 3 días</b></li><li><b>Foto real</b> de cada pieza</li><li>Efectivo, Yappy o ACH</li><li>Lunes a sábado, 8:00 a. m. a 5:00 p. m.</li></ul>'
def cabecera(h1, intro, wa_txt, wa_msg, extra=''):
    return f'''<div class="cab"><div class="w">@@MIGA@@<h1>{e(h1)}</h1><p class="sub">{intro}</p>
<div class="btns"><a class="btn wa" href="https://wa.me/{WA}?text={q(wa_msg)}">{e(wa_txt)}</a><a class="btn linea" href="{WAZE}">Cómo llegar</a></div>{CONF}{extra}</div></div>'''
def top_cats(L, n=5):
    c = collections.Counter(p['categoria'] for p in L)
    return ', '.join(f'{plural(k).lower()} ({v})' for k, v in c.most_common(n))
for d_ in ('m', 'mo', 'c', 'p'): os.makedirs(d_, exist_ok=True)
urls_lista = []; vivas_d = {'m': set(), 'mo': set(), 'c': set()}

# 3a) por marca
for mk, L in sorted(pm.items()):
    nm = nmarca[mk]; sl = slug(mk); vivas_d['m'].add(sl + '.html')
    mods = sorted([k for k in pmod if k[0] == mk], key=lambda k: -len(pmod[k]))
    chips = ('<h2>Por modelo</h2><div class="chips">' + ''.join(f'<a href="../mo/{smodelo(k)}.html">{e(nmodelo(k))} <small>{len(pmod[k])}</small></a>' for k in mods) + '</div>') if mods else ''
    cats = collections.defaultdict(list)
    for p in L: cats[p['categoria']].append(p)
    body = ''.join(f'<h2>{e(plural(c))} para {e(nm)} <small>{len(v)}</small></h2><div class="g">' + ''.join(tarjeta(p, modelo(p.get('modelo')) or nm, detalle(p)) for p in v) + '</div>'
                   for c, v in sorted(cats.items(), key=lambda x: -len(x[1])))
    otras = '<h2>Otras marcas</h2><div class="chips">' + ''.join(f'<a href="{slug(k)}.html">{e(nmarca[k])}</a>' for k in sorted(pm, key=lambda k: -len(pm[k])) if k != mk) + '</div>'
    desc = f"{len(L)} piezas de carrocería para {nm} en Panamá con foto real: {top_cats(L)}. Garantía de 3 días. Rastro Búnker, Calidonia · WhatsApp 6160-1991."
    urls_lista.append(pagina(f'm/{sl}.html', f'Piezas de carrocería para {nm} en Panamá · Rastro Búnker', desc, [(nm, None)],
        cabecera(f'Piezas de carrocería para {nm} en Panamá', f'{len(L)} piezas disponibles hoy, cada una con su foto y su código: {e(top_cats(L, 4))}.', f'Pregunta por tu pieza para {nm}', f'Hola, busco una pieza para {nm}')
        + f'<div class="w">{chips}{body}{otras}</div>'))

# 3b) por modelo
for k, L in sorted(pmod.items()):
    mk = k[0]; nm = nmarca[mk]; md = nmodelo(k); full = f'{nm} {md}'; sl = smodelo(k); vivas_d['mo'].add(sl + '.html')
    cats = collections.defaultdict(list)
    for p in L: cats[p['categoria']].append(p)
    body = ''.join(f'<h2>{e(plural(c))} para {e(full)} <small>{len(v)}</small></h2><div class="g">' + ''.join(tarjeta(p, modelo(p.get('modelo')), detalle(p)) for p in v) + '</div>'
                   for c, v in sorted(cats.items(), key=lambda x: -len(x[1])))
    herm = [x for x in sorted(pmod, key=lambda x: -len(pmod[x])) if x[0] == mk and x != k][:24]
    otras = (f'<h2>Otros modelos de {e(nm)}</h2><div class="chips">' + ''.join(f'<a href="{smodelo(x)}.html">{e(nmodelo(x))} <small>{len(pmod[x])}</small></a>' for x in herm) + '</div>') if herm else ''
    desc = f"{len(L)} piezas de carrocería para {full} en Panamá con foto real: {top_cats(L)}. Garantía de 3 días. Rastro Búnker, Calidonia · WhatsApp 6160-1991."
    urls_lista.append(pagina(f'mo/{sl}.html', f'Piezas para {full} en Panamá: defensas, faros, parrillas · Rastro Búnker', desc, [(nm, f'../m/{slug(mk)}.html'), (md, None)],
        cabecera(f'Piezas de carrocería para {full}', f'{len(L)} piezas disponibles hoy para {e(full)}, cada una con su foto y su código: {e(top_cats(L, 4))}. Dinos el año de tu carro y te confirmamos si le sirve.', f'Pregunta por tu pieza para {md}', f'Hola, busco una pieza para {full}')
        + f'<div class="w">{body}{otras}</div>'))

# 3c) por tipo de pieza
for c, L in sorted(pc.items()):
    pl = plural(c); sl = slug(c); vivas_d['c'].add(sl + '.html')
    porm = collections.defaultdict(list)
    for p in L: porm[mkey(p['marca'])].append(p)
    orden = sorted(porm, key=lambda k: -len(porm[k]))
    salto = '<div class="chips">' + ''.join(f'<a href="#{slug(k)}">{e(nmarca[k])} <small>{len(porm[k])}</small></a>' for k in orden) + '</div>'
    body = ''.join(f'<h2 id="{slug(k)}">{e(pl)} para {e(nmarca[k])} <small>{len(porm[k])}</small></h2><div class="g">' + ''.join(tarjeta(p, f'{nmarca[k]} {modelo(p.get("modelo"))}'.strip(), detalle(p)) for p in porm[k]) + '</div>' for k in orden)
    otras = '<h2>Otros tipos de pieza</h2><div class="chips">' + ''.join(f'<a href="{slug(x)}.html">{e(plural(x))} <small>{len(pc[x])}</small></a>' for x in sorted(pc, key=lambda x: -len(pc[x])) if x != c) + '</div>'
    marcas_txt = ', '.join(nmarca[k] for k in orden[:6])
    desc = f"{len(L)} {pl.lower()} usadas y nuevas en Panamá con foto real, para {marcas_txt} y más. Garantía de 3 días. Rastro Búnker, Calidonia · WhatsApp 6160-1991."
    urls_lista.append(pagina(f'c/{sl}.html', f'{pl} usadas y nuevas en Panamá · Rastro Búnker', desc, [(pl, None)],
        cabecera(f'{pl} en Panamá', f'{len(L)} disponibles hoy, originales y genéricas, cada una con su foto y su código. Elige la marca de tu carro:', f'Pregunta por tu pieza', f'Hola, busco {pl.lower()} para mi carro', salto)
        + f'<div class="w">{body}{otras}</div>'))
for d_, viv in vivas_d.items():
    for f in os.listdir(d_):
        if f not in viv: os.remove(os.path.join(d_, f))

# 3d) por pieza
vivas = set(); urls = []
for p in prod:
    cod = str(p['codigo']); vivas.add(cod + '.html')
    nombre = nombre_de(p)
    det = ', '.join(x for x in [LADO.get(p.get('lado') or ''), COND.get((p.get('condicion') or '').upper())] if x)
    vend = bool(p.get('vendido'))
    desc = f"{nombre}{(' · ' + det) if det else ''}. Código #{cod}. " + ('Pieza vendida; pregunta por otra igual. ' if vend else '') + "Rastro Búnker, autopartes de carrocería en Panamá. WhatsApp 6160-1991."
    tiene = os.path.exists(f"o/{p['id']}.jpg")
    img = SITE + (f"o/{p['id']}.jpg" if tiene else 'og.jpg')
    url = SITE + f'p/{cod}.html'
    mk = mkey(p.get('marca')); nm = marca(p.get('marca')); km = modelo_de(p) if not vendida(p) else None
    ld = {"@context": "https://schema.org", "@type": "Product", "name": nombre, "sku": cod, "image": img, "description": desc, "category": p['categoria'],
          "brand": {"@type": "Brand", "name": nm}}
    wa = f"https://wa.me/{WA}?text=" + q(f"Hola, me interesa la pieza: {nombre} - Código #{cod} {url}")
    miga = ([(nm, f'../m/{slug(mk)}.html')] if mk in pm else []) + ([(nmodelo(km), f'../mo/{smodelo(km)}.html')] if km else []) + [(f'{p["categoria"]} #{cod}', None)]
    filas = [('Pieza', p['categoria']), ('Marca', nm), ('Modelo', modelo(p.get('modelo'))), ('Años', str(p.get('anio') or '')), ('Lado', LADO.get(p.get('lado') or '', '')),
             ('Condición', COND.get((p.get('condicion') or '').upper(), '')), ('Código', '#' + cod)]
    dl = '<dl class="dl">' + ''.join(f'<dt>{e(a_)}</dt><dd>{e(b_[:1].upper() + b_[1:])}</dd>' for a_, b_ in filas if b_) + '</dl>'
    mas = (f'<a class="btn linea" href="../mo/{smodelo(km)}.html">Más piezas para {e(nm)} {e(nmodelo(km))}</a>' if km else
           (f'<a class="btn linea" href="../m/{slug(mk)}.html">Más piezas para {e(nm)}</a>' if mk in pm else ''))
    cuerpo = f'''<div class="w"><div style="padding-top:18px">@@MIGA@@</div><div class="ficha">
<div class="foto">{f'<img src="../f/{p["id"]}.webp" alt="{e(nombre)}" width="760" height="570">' if tiene else ''}<i class="cinta">{e(cod)}</i></div>
<div><h1 style="font-size:clamp(26px,5vw,36px)">{e(nombre)}</h1>{dl}
<p id="vend" class="aviso"{'' if vend else ' hidden'}>Esta pieza ya se vendió. Escríbenos y te avisamos cuando llegue otra igual.</p>
<a class="btn wa" href="{e(wa)}">Consultar precio por WhatsApp</a>
<a class="btn rojo" href="../?p={cod}">Ver en el catálogo</a>{mas}
<p class="nota"><b>Garantía de 3 días</b> después de la entrega · Efectivo, Yappy o ACH<br>Retiro en Calidonia, ciudad de Panamá · Lunes a sábado, 8:00 a. m. a 5:00 p. m. · <a href="{WAZE}">Llegar con Waze</a></p></div></div></div>
<script>fetch('https://firestore.googleapis.com/v1/projects/rastrobunker-caja/databases/(default)/documents/vendidos/{cod}?key=AIzaSyDmVL8mLvzjWr69Ab-s8Lf0A-H_JtWaTXk').then(r=>r.ok?r.json():null).then(j=>{{if(!j||!j.fields)return;var u=j.fields.unidades||{{}};if(+(u.integerValue||u.doubleValue||0)>={p.get('cantidad') or 1})document.getElementById('vend').hidden=false}}).catch(function(){{}});</script>'''
    pagina(f'p/{cod}.html', f'{nombre} · Rastro Búnker Panamá', desc, miga, cuerpo, img=img, tipo='product', ld=ld, noindex=vend)
    if not vendida(p): urls.append(url)
for f in os.listdir('p'):
    if f not in vivas: os.remove('p/' + f)
urls = urls_lista + urls

# 3e) enlaces en el pie del catálogo (marcas, tipos de pieza y modelos más buscados) y cantidad de piezas en su descripción
topm = sorted(pmod, key=lambda k: -len(pmod[k]))[:30]
pie = ('<!--RB-MARCAS--><nav class="rb-pie-marcas" aria-label="Piezas por marca, tipo y modelo"><b>Piezas por marca:</b> ' + ' · '.join(f'<a href="m/{slug(k)}.html">{e(nmarca[k])}</a>' for k in sorted(pm, key=lambda k: -len(pm[k])))
       + '<br><b>Por tipo de pieza:</b> ' + ' · '.join(f'<a href="c/{slug(c)}.html">{e(plural(c))}</a>' for c in sorted(pc, key=lambda c: -len(pc[c])))
       + '<br><b>Modelos más buscados:</b> ' + ' · '.join(f'<a href="mo/{smodelo(k)}.html">{e(nmarca[k[0]])} {e(nmodelo(k))}</a>' for k in topm) + '</nav><!--/RB-MARCAS-->')
if '<!--RB-MARCAS-->' in h: h = re.sub(r'<!--RB-MARCAS-->.*?<!--/RB-MARCAS-->', lambda m_: pie, h, flags=re.S)
else:
    ancla = '<div class="footer-note">'; assert h.count(ancla) == 1
    h = h.replace(ancla, pie + '\n  ' + ancla)
    h = h.replace('<style id="rb-mejoras-css">', '<style id="rb-mejoras-css">\n.rb-pie-marcas{max-width:900px;margin:18px auto 0;padding:0 14px;font-size:12.5px;line-height:1.9;text-align:center;opacity:.8}.rb-pie-marcas a{color:inherit}', 1)
cab = h[:h.find('</head>')]
cab2 = re.sub(r'([Mm]ás de )[\d,]+( piezas)', lambda m_: m_.group(1) + N_RED + m_.group(2), cab)
h = cab2 + h[len(cab):]
open('index.html', 'w', encoding='utf-8').write(h)
json.dump({'marcas': [[nmarca[k], f'm/{slug(k)}.html', len(pm[k])] for k in sorted(pm, key=lambda k: -len(pm[k]))],
           'tipos': [[plural(c), f'c/{slug(c)}.html', len(pc[c])] for c in sorted(pc, key=lambda c: -len(pc[c]))],
           'modelos': [[f'{nmarca[k[0]]} {nmodelo(k)}', f'mo/{smodelo(k)}.html', len(pmod[k])] for k in sorted(pmod, key=lambda k: -len(pmod[k]))]},
          open('tools/_listas.json', 'w', encoding='utf-8'), ensure_ascii=False)
print(f'páginas: {len(pm)} marcas · {len(pmod)} modelos · {len(pc)} tipos de pieza')

# 4) sitemap, robots, versiones
open('sitemap.xml', 'w', encoding='utf-8').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + f'<url><loc>{SITE}</loc></url>\n<url><loc>{SITE}inicio.html</loc></url>\n' + ''.join(f'<url><loc>{u}</loc></url>\n' for u in urls) + '</urlset>\n')
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

# 5) página de inicio (inicio.html) con las cantidades y fotos de hoy
import subprocess
subprocess.run([sys.executable, os.path.join('tools', 'generar_inicio.py')], check=False)

