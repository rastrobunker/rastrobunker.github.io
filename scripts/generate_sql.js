// One-off script to extract PRODUCTOS_INICIALES from index.html and generate MySQL DDL + INSERT files.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const marker = 'const PRODUCTOS_INICIALES = ';
const startIdx = html.indexOf(marker);
if (startIdx === -1) throw new Error('PRODUCTOS_INICIALES not found');
const arrStart = startIdx + marker.length; // points at '['

// Find matching closing bracket for the array by scanning balanced brackets
function findArrayEnd(str, openIdx) {
  let depth = 0;
  let inStr = false;
  let strChar = '';
  let escaped = false;
  for (let i = openIdx; i < str.length; i++) {
    const c = str[i];
    if (inStr) {
      if (escaped) { escaped = false; }
      else if (c === '\\') { escaped = true; }
      else if (c === strChar) { inStr = false; }
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; strChar = c; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) return i; }
  }
  throw new Error('Unbalanced brackets');
}

const arrEnd = findArrayEnd(html, arrStart);
const arrText = html.slice(arrStart, arrEnd + 1);
const productos = JSON.parse(arrText);

console.log('Total productos:', productos.length);

// Determine set of fields present across all products
const fieldSet = new Set();
for (const p of productos) Object.keys(p).forEach(k => fieldSet.add(k));
console.log('Fields:', Array.from(fieldSet));

// ---------- DDL ----------
const ddl = `-- DDL para Rastro Búnker - Catálogo de Piezas
-- Generado automáticamente a partir de index.html

CREATE DATABASE IF NOT EXISTS rastro_bunker
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE rastro_bunker;

DROP TABLE IF EXISTS productos;

CREATE TABLE productos (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()),
  id_legacy     INT UNSIGNED NULL COMMENT 'ID numerico original del catalogo',
  codigo        VARCHAR(20)  NULL,
  categoria     VARCHAR(100) NULL,
  marca         VARCHAR(100) NULL,
  modelo        VARCHAR(100) NULL,
  anio          VARCHAR(20)  NULL,
  lado          VARCHAR(10)  NULL,
  condicion     VARCHAR(20)  NULL,
  precio        DECIMAL(10,2) NULL,
  vendido       TINYINT(1)   NOT NULL DEFAULT 0,
  cantidad      INT          NULL,
  detalle       TEXT         NULL,
  posicion      VARCHAR(50)  NULL,
  bgc           VARCHAR(20)  NULL COMMENT 'Color de fondo de la tarjeta',
  fit           VARCHAR(20)  NULL COMMENT 'Estilo de ajuste de la foto (ej. contain/full)',
  alias         VARCHAR(150) NULL,
  foto          LONGTEXT     NULL COMMENT 'Imagen en base64 (data URI)',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_categoria (categoria),
  KEY idx_marca (marca),
  KEY idx_vendido (vendido)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

fs.writeFileSync(path.join(ROOT, 'ddl.sql'), ddl, 'utf8');
console.log('Wrote ddl.sql');

// ---------- INSERTs ----------
function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}
function num(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  return Number(v);
}
function bool(v) { return v ? 1 : 0; }

const outPath = path.join(ROOT, 'insert_productos.sql');
const stream = fs.createWriteStream(outPath, { encoding: 'utf8' });

stream.write('-- INSERT de productos para Rastro Búnker\n');
stream.write('-- Generado automáticamente a partir de index.html\n\n');
stream.write('USE rastro_bunker;\n\n');

const cols = ['id','id_legacy','codigo','categoria','marca','modelo','anio','lado','condicion','precio','vendido','cantidad','detalle','posicion','bgc','fit','alias','foto'];

const BATCH = 20; // group inserts to keep statements reasonably sized despite large base64 values
for (let i = 0; i < productos.length; i += BATCH) {
  const batch = productos.slice(i, i + BATCH);
  const rows = batch.map(p => {
    const vals = [
      esc(crypto.randomUUID()),
      num(p.id),
      esc(p.codigo),
      esc(p.categoria),
      esc(p.marca),
      esc(p.modelo),
      esc(p.anio),
      esc(p.lado),
      esc(p.condicion),
      num(p.precio),
      bool(p.vendido),
      num(p.cantidad),
      esc(p.detalle),
      esc(p.posicion),
      esc(p.bgc),
      esc(p.fit),
      esc(p.alias),
      esc(p.foto),
    ];
    return '(' + vals.join(',') + ')';
  });
  stream.write(`INSERT INTO productos (${cols.join(',')}) VALUES\n`);
  stream.write(rows.join(',\n'));
  stream.write(';\n\n');
}

stream.end(() => console.log('Wrote insert_productos.sql'));
