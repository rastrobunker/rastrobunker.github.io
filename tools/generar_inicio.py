#!/usr/bin/env python3
"""Rastro Búnker · generar_inicio.py
Arma inicio.html (la página de presentación del negocio) con datos reales del catálogo:
cantidad de piezas, marcas, categorías y fotos. No gasta lecturas de Firebase: todo va fijo
en el archivo. Lo llama tools/generar_sitio.py al final; también se puede correr solo.
La plantilla está en tools/inicio_plantilla.html (texto, diseño y mapa se cambian ahí).
"""
import re, json, os, io, base64, unicodedata, html
from PIL import Image
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(R)
SITE = 'https://rastrobunker.github.io/'
h = open('index.html', encoding='utf-8').read()
i = h.find('const PRODUCTOS_INICIALES'); a = h.find('[', i); b = h.find('];', i)
prod = json.loads(h[a:b + 1])
try: V = json.load(open('vendidos.json', encoding='utf-8'))['d']
except Exception: V = {}
disp = [p for p in prod if not p.get('vendido') and V.get(str(p['codigo']), 0) < (p.get('cantidad') or 1)]
UP = {'BMW', 'GAC', 'MG', 'JAC', 'GMC', 'BYD', 'DFSK', 'RAM', 'KIA', 'JMC'}
def marca(m):
    m = (m or '').strip(); return m.upper() if m.upper() in UP else m.title()
def slug(m):
    t = unicodedata.normalize('NFD', (m or 'otras').strip().lower()); t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-') or 'otras'
def foto(pid, w=380, q=70):
    im = Image.open(f'f/{pid}.webp').convert('RGB'); im.thumbnail((w, w)); o = io.BytesIO(); im.save(o, 'WEBP', quality=q)
    return 'data:image/webp;base64,' + base64.b64encode(o.getvalue()).decode()
def archivo(ruta, w, q=72, fmt='JPEG'):
    im = Image.open(ruta); im = im.convert('RGBA' if fmt == 'PNG' else 'RGB'); im.thumbnail((w, w * 2)); o = io.BytesIO()
    im.save(o, fmt, **({} if fmt == 'PNG' else {'quality': q}))
    return f'data:image/{fmt.lower()};base64,' + base64.b64encode(o.getvalue()).decode()
def mejores(cat, n=2):
    c = [p for p in disp if p['categoria'] == cat and os.path.exists(f"f/{p['id']}.webp")]
    return sorted(c, key=lambda p: -(p.get('precio') or 0))[:n]
e = html.escape

# --- piezas de portada (la más cara disponible de tres categorías) ---
usadas, portada = set(), []
for cat in ('Defensa Delantera', 'Lámpara Delantera', 'Capó'):
    for p in mejores(cat, 1):
        usadas.add(p['id'])
        portada.append(f'''<a class="pz" href="{SITE}?p={e(str(p['codigo']))}"><img src="{foto(p['id'])}" alt="{e(cat)} {e(marca(p['marca']))} {e(p['modelo'])}" width="380" height="285"><span class="cinta">{e(marca(p['marca']))} {e(p['modelo'])} · {e(str(p['codigo']))}</span></a>''')

# --- categorías ---
CATS = [('Faros delanteros', 'Lámpara Delantera', 'faro delantero'), ('Lámparas traseras', 'Lámpara Trasera', 'lampara trasera'),
        ('Defensas delanteras', 'Defensa Delantera', 'defensa delantera'), ('Defensas traseras', 'Defensa Trasera', 'defensa trasera'),
        ('Parrillas', 'Parrilla', 'parrilla'), ('Guardafangos', 'Guardafango', 'guardafango'), ('Puertas', 'Puerta', 'puerta'), ('Capós', 'Capó', 'capo')]
cats = []
for nom, cat, q in CATS:
    n = sum(1 for p in disp if p['categoria'] == cat)
    c = [p for p in mejores(cat, 3) if p['id'] not in usadas]
    if not n or not c: continue
    cats.append(f'''<a class="cat" href="{SITE}?q={q.replace(' ', '%20')}"><img src="{foto(c[0]['id'], 300, 66)}" alt="{e(nom)}" width="300" height="225"><b>{e(nom)}</b><span>{n} piezas</span></a>''')
ncat = len({p['categoria'] for p in disp})

# --- marcas ---
cm = {}
for p in disp:
    k_ = p['marca'].strip().upper().replace('-', ' '); cm[k_] = cm.get(k_, 0) + 1
top = sorted(cm.items(), key=lambda x: -x[1])
marcas = ''.join(f'<a href="{SITE}m/{slug(m)}.html">{e(marca(m))} <small>{n}</small></a>' for m, n in top[:14] if os.path.exists(f'm/{slug(m)}.html'))
chips = ''.join(f'<a href="{SITE}m/{slug(m)}.html">{e(marca(m))}</a>' for m, n in top[:5])

# --- ruta en fotos (cuadros del video de ubicación que ya está en el sitio) ---
RUTA = [('ruta1.jpg', 'Pasa frente a El Costo.'), ('ruta2.jpg', 'Sigue derecho por esa misma calle.'),
        ('ruta3.jpg', 'Haz el retorno en el edificio amarillo redondo.'), ('ruta4.jpg', 'Sigue hasta pasar el edificio verde.'),
        ('ruta5.jpg', 'La entrada del local es la puerta roja.')]
ruta = ''.join(f'<li><img src="{archivo("tools/inicio/" + f, 300, 66)}" alt="" width="300" height="375"><span><b>{k}</b>{e(t)}</span></li>' for k, (f, t) in enumerate(RUTA, 1))

# --- listas completas para Google y para quien busca por modelo (las arma generar_sitio.py) ---
try: LST = json.load(open('tools/_listas.json', encoding='utf-8'))
except Exception: LST = {'tipos': [], 'modelos': []}
tipos = ''.join(f'<a href="{SITE}{u}">{e(n)} <small>{c}</small></a>' for n, u, c in LST['tipos'])
modelos = ''.join(f'<a href="{SITE}{u}">{e(n)} <small>{c}</small></a>' for n, u, c in LST['modelos'][:36])

org = sum(1 for p in disp if str(p.get('condicion') or '').upper().startswith(('ORG', 'FULL ORG')))
datos = {
    'N_PIEZAS': f'{(len(disp) // 100) * 100:,}', 'N_EXACTO': f'{len(disp):,}', 'N_MARCAS': str(len(cm)), 'N_CATS': str(ncat),
    'PCT_ORG': str(round(100 * org / max(len(disp), 1))),
    'PORTADA': ''.join(portada), 'CATS': ''.join(cats), 'MARCAS': marcas, 'TIPOS': tipos, 'MODELOS': modelos, 'CHIPS': chips, 'RUTA': ruta,
    'LOGO': archivo('icon-512.png', 96, fmt='PNG'), 'POSTER': archivo('tools/inicio/ruta1.jpg', 300, 60),
}
t = open('tools/inicio_plantilla.html', encoding='utf-8').read()
for k, v in datos.items(): t = t.replace('@@' + k + '@@', v)
assert '@@' not in t, re.findall(r'@@\w+@@', t)
open('inicio.html', 'w', encoding='utf-8').write(t)
print(f'inicio.html: {len(t) // 1024} KB · {len(disp)} piezas disponibles · {len(cm)} marcas · {org} originales')
