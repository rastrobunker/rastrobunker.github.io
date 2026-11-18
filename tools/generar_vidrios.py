"""
Arma vidrios.html: lista privada SOLO de vidrios (con precio) para talleres de
parabrisas y carrocería. No tiene enlaces al resto del catálogo, no sale en el
sitemap y robots.txt la excluye. La corre generar_sitio.py al final.
Las piezas vendidas se esconden solas (vendidos.json).
"""
import json, re, base64, io, os
from PIL import Image

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
t = open('index.html', encoding='utf-8').read()
i = t.find('const PRODUCTOS_INICIALES'); a = t.find('[', i); b = t.find('];', i)
P = json.loads(t[a:b + 1])
try:
    VEN = json.load(open('vendidos.json'))['d']
except Exception:
    VEN = {}

def tipo(det):
    d = (det or '').lower()
    if 'parabrisas delantero' in d: return 'Parabrisas'
    if 'trasero (parabrisas' in d or d.startswith('vidrio trasero'): return 'Vidrio trasero'
    if 'fijo' in d or 'ventanilla' in d or 'cuarto' in d: return 'Cuarto / ventanilla'
    if 'puerta delantera' in d: return 'Puerta delantera'
    if 'puerta trasera' in d or 'corrediza' in d: return 'Puerta trasera'
    return 'Cuarto / ventanilla'

def marca(m):
    m = m.strip()
    return {'KIA': 'Kia', 'MERCEDES-BENZ': 'Mercedes-Benz'}.get(m.upper(), m if len(m) <= 4 else m.title())

def modelo(m):
    fix = {'RIO': 'Rio', 'I30': 'i30', 'GRAND I10': 'Grand i10', 'D-MAX': 'D-Max'}
    if m.upper() in fix: return fix[m.upper()]
    return ' '.join(w if (len(w) <= 3 or any(c.isdigit() for c in w)) else w.title() for w in m.split())

def cond(p):
    c = (p.get('condicion') or '').upper()
    nuevo = 'NEW' in c or 'Nuevo' in (p.get('detalle') or '')
    return ('Original' if 'ORG' in c else 'Genérico') + (' · Nuevo' if nuevo else ' · Usado')

V = []
for p in P:
    if p.get('categoria') != 'Vidrio': continue
    det = (p.get('detalle') or '').replace(' Nuevo, en su empaque.', '').replace(' Nuevo.', '').strip().rstrip('.')
    V.append({'c': p['codigo'], 'id': p['id'], 'v': bool(p.get('vendido')) or bool(VEN.get(p['codigo'])),
              'ti': tipo(det), 'pz': det, 'ma': marca(p['marca']), 'mo': modelo(p['modelo']), 'a': p.get('anio') or '',
              'l': {'RH': 'Derecho', 'LH': 'Izquierdo'}.get(p.get('lado'), ''), 'co': cond(p), 'pr': p.get('precio') or 0})
V.sort(key=lambda x: int(re.sub(r'\D', '', x['c']) or 0))
disp = [x for x in V if not x['v']]

im = Image.open('icon-512.png').convert('RGBA'); im.thumbnail((80, 80))
bb = io.BytesIO(); im.save(bb, 'PNG'); LOGO = 'data:image/png;base64,' + base64.b64encode(bb.getvalue()).decode()

HTML = r'''<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>Vidrios automotrices · Rastro Búnker</title>
<style>
:root{--bg:#f4f2ee;--card:#fff;--ink:#151515;--mut:#6b6b6b;--line:#e3ded6;--red:#d81e27;--grn:#1fa34a;--dk:#17191d}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
header{background:var(--dk);color:#fff;padding:14px 16px 16px}
.hw{max-width:1100px;margin:0 auto;display:flex;gap:12px;align-items:center}
.hw img{width:52px;height:52px;border-radius:12px;flex:none}
h1{margin:0;font-size:21px;line-height:1.15}.sub{color:#c9c9c9;font-size:13px;margin-top:3px}
.para{max-width:1100px;margin:10px auto 0;font-size:13px;color:#e6e6e6;background:rgba(255,255,255,.07);border-radius:10px;padding:8px 10px}
main{max-width:1100px;margin:0 auto;padding:12px 12px 40px}
.fil{position:sticky;top:0;z-index:5;background:var(--bg);padding:8px 0 10px}
#q{width:100%;font-size:17px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:#fff}
.chips{display:flex;gap:8px;overflow-x:auto;padding-top:8px;scrollbar-width:none}.chips::-webkit-scrollbar{display:none}
.chips button{flex:none;border:1px solid var(--line);background:#fff;border-radius:999px;padding:8px 13px;font:600 14px system-ui,sans-serif;color:var(--ink)}
.chips button.on{background:var(--dk);color:#fff;border-color:var(--dk)}
#n{font-size:13px;color:var(--mut);margin:6px 2px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;margin-top:8px}
.c{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
.c img{width:100%;aspect-ratio:4/3;object-fit:cover;background:#ddd;display:block;cursor:zoom-in}
.b{padding:10px 12px 12px;display:flex;flex-direction:column;gap:3px;flex:1}
.tag{align-self:flex-start;font-size:11px;font-weight:800;letter-spacing:.3px;text-transform:uppercase;color:var(--red)}
.t{font-weight:800;font-size:16px}.d{font-size:13px;color:var(--mut)}
.row{display:flex;justify-content:space-between;align-items:flex-end;margin-top:auto;padding-top:8px;gap:8px}
.pr{font-size:23px;font-weight:900}.cod{font-size:12px;color:var(--mut)}
.wa{display:block;text-align:center;margin-top:8px;background:var(--grn);color:#fff;text-decoration:none;font-weight:800;padding:11px;border-radius:10px}
#zoom{position:fixed;inset:0;background:rgba(0,0,0,.88);display:none;align-items:center;justify-content:center;z-index:20;padding:14px}
#zoom img{max-width:100%;max-height:100%;border-radius:10px}
footer{max-width:1100px;margin:0 auto;padding:0 14px 30px;color:var(--mut);font-size:13px;text-align:center}
.vacio{padding:30px;text-align:center;color:var(--mut)}
</style></head><body>
<header><div class="hw"><img src="@@LOGO@@" alt="Rastro Búnker"><div><h1>Vidrios automotrices</h1>
<div class="sub">Rastro Búnker · Calidonia, Panamá · WhatsApp 6160-1991</div></div></div>
<div class="para">Lista para <b>Windscreens and Bodyworks</b> (parabrisas y carrocería): parabrisas, vidrios traseros, de puerta y cuartos. Precios en dólares. Pregunte por precio especial por cantidad.</div></header>
<main><div class="fil"><input id="q" type="search" placeholder="Buscar: marca, modelo, año o código" autocomplete="off">
<div class="chips" id="tipos"></div><div class="chips" id="marcas"></div><div id="n"></div></div>
<div class="grid" id="g"></div></main>
<div id="zoom"><img alt=""></div>
<footer>Rastro Búnker · Lunes a sábado 8:00 a. m. a 5:00 p. m. · Waze: “Rastro Búnker” · Lista actualizada el @@FECHA@@</footer>
<script>
const V=@@DATA@@;
const WA='50761601991';let tipo='Todos',mar='Todas',q='';
const norm=s=>(s||'').toString().normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
function chips(el,vals,cur,set){el.innerHTML=vals.map(v=>`<button class="${v===cur?'on':''}">${v}</button>`).join('');
[...el.children].forEach((b,i)=>b.onclick=()=>{set(vals[i]);pinta()})}
function pinta(){const vis=V.filter(x=>!x.v);
const TIP=['Todos','Parabrisas','Vidrio trasero','Puerta delantera','Puerta trasera','Cuarto / ventanilla'].filter(t=>t==='Todos'||vis.some(x=>x.ti===t));
const MAR=['Todas',...[...new Set(vis.map(x=>x.ma))].sort()];
chips(document.getElementById('tipos'),TIP,tipo,v=>tipo=v);chips(document.getElementById('marcas'),MAR,mar,v=>mar=v);
const w=norm(q).split(/\s+/).filter(Boolean);
const L=vis.filter(x=>(tipo==='Todos'||x.ti===tipo)&&(mar==='Todas'||x.ma===mar)&&w.every(k=>norm([x.c,x.ma,x.mo,x.a,x.pz,x.l,x.ti].join(' ')).includes(k)));
document.getElementById('n').textContent=L.length+' de '+vis.length+' vidrios';
document.getElementById('g').innerHTML=L.length?L.map(x=>{return `<div class="c"><img loading="lazy" src="f/${x.id}.webp" alt="${x.pz} ${x.ma} ${x.mo}"><div class="b"><span class="tag">${x.ti}</span>
<div class="t">${x.ma} ${x.mo} ${x.a}</div><div class="d">${x.pz}${x.l?' · '+x.l:''}</div><div class="d">${x.co}</div>
<div class="row"><span class="pr">$${x.pr}</span><span class="cod">Código ${x.c}</span></div>
</div></div>`}).join(''):'<div class="vacio">No hay vidrios con esa búsqueda.</div>';
document.querySelectorAll('.c img').forEach(i=>i.onclick=()=>{const z=document.getElementById('zoom');z.querySelector('img').src=i.src;z.style.display='flex'})}
document.getElementById('zoom').onclick=e=>e.currentTarget.style.display='none';
document.getElementById('q').oninput=e=>{q=e.target.value;pinta()};
pinta();
fetch('vendidos.json?'+Date.now()).then(r=>r.json()).then(j=>{const d=j.d||{};let c=0;V.forEach(x=>{if(d[x.c]&&!x.v){x.v=true;c++}});if(c)pinta()}).catch(()=>{});
</script></body></html>'''
import datetime
fecha = datetime.date.today().strftime('%d-%m-%Y')
out = HTML.replace('@@LOGO@@', LOGO).replace('@@FECHA@@', fecha).replace('@@DATA@@', json.dumps(V, ensure_ascii=False, separators=(',', ':')))
open('vidrios.html', 'w', encoding='utf-8').write(out)
print(f'vidrios.html: {len(out) // 1024} KB · {len(disp)} vidrios disponibles')
