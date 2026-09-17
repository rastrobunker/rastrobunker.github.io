import { prisma } from '~/server/utils/prisma'
import type { Producto } from '@prisma/client'

// Mantiene productos_mv sincronizada a nivel de aplicacion.
// Alternativa a los triggers de sql/materialized_view.sql, necesaria porque el usuario
// de RDS no tiene privilegio SUPER/SYSTEM_VARIABLES_ADMIN para crear triggers
// (requiere log_bin_trust_function_creators=1 en el Parameter Group de RDS).
export async function upsertProductoMv(p: Producto) {
  const data = {
    idLegacy: p.idLegacy,
    codigo: p.codigo,
    categoria: p.categoria,
    marca: p.marca,
    modelo: p.modelo,
    anio: p.anio,
    lado: p.lado,
    condicion: p.condicion,
    precio: p.precio,
    vendido: p.vendido,
    cantidad: p.cantidad,
    posicion: p.posicion,
    alias: p.alias,
    tieneFoto: p.foto !== null,
  }

  await prisma.productoMv.upsert({
    where: { id: p.id },
    create: { id: p.id, ...data },
    update: data,
  })
}

export async function deleteProductoMv(id: string) {
  await prisma.productoMv.deleteMany({ where: { id } })
}
