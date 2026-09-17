// Robust importer: parses PRODUCTOS_INICIALES directly from index.html (same logic as
// scripts/generate_sql.js) and inserts every row with a parameterized query via mysql2,
// avoiding the text-splitting fragility of executing the generated insert_productos.sql file.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import mysql from 'mysql2/promise'

const htmlPath = path.resolve(process.cwd(), '..', 'index.html')
const html = fs.readFileSync(htmlPath, 'utf8')

const marker = 'const PRODUCTOS_INICIALES = '
const startIdx = html.indexOf(marker)
if (startIdx === -1) throw new Error('PRODUCTOS_INICIALES not found')
const arrStart = startIdx + marker.length

function findArrayEnd(str: string, openIdx: number) {
  let depth = 0
  let inStr = false
  let strChar = ''
  let escaped = false
  for (let i = openIdx; i < str.length; i++) {
    const c = str[i]
    if (inStr) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === strChar) inStr = false
      continue
    }
    if (c === '"' || c === "'") { inStr = true; strChar = c; continue }
    if (c === '[') depth++
    else if (c === ']') { depth--; if (depth === 0) return i }
  }
  throw new Error('Unbalanced brackets')
}

const arrEnd = findArrayEnd(html, arrStart)
const productos = JSON.parse(html.slice(arrStart, arrEnd + 1))

console.log('Total productos a importar:', productos.length)

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!)

  await connection.query('DELETE FROM productos')

  const cols = ['id', 'id_legacy', 'codigo', 'categoria', 'marca', 'modelo', 'anio', 'lado', 'condicion', 'precio', 'vendido', 'cantidad', 'detalle', 'posicion', 'bgc', 'fit', 'alias', 'foto']
  const placeholders = `(${cols.map(() => '?').join(',')})`
  const insertSql = `INSERT INTO productos (${cols.join(',')}) VALUES ${placeholders}`

  let count = 0
  for (const p of productos) {
    const values = [
      crypto.randomUUID(),
      p.id ?? null,
      p.codigo ?? null,
      p.categoria ?? null,
      p.marca ?? null,
      p.modelo ?? null,
      p.anio ?? null,
      p.lado ?? null,
      p.condicion ?? null,
      p.precio ?? null,
      p.vendido ? 1 : 0,
      p.cantidad ?? null,
      p.detalle ?? null,
      p.posicion ?? null,
      p.bgc ?? null,
      p.fit ?? null,
      p.alias ?? null,
      p.foto ?? null,
    ]
    await connection.query(insertSql, values)
    count++
    if (count % 100 === 0) console.log(`  ${count}/${productos.length}`)
  }

  const [rows] = await connection.query('SELECT COUNT(*) AS n FROM productos')
  console.log('Total productos insertados:', (rows as any)[0].n)
  await connection.end()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
