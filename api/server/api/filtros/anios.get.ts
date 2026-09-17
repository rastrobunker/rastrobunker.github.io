import { prisma } from '~/server/utils/prisma'
import type { Prisma } from '@prisma/client'

// GET /api/filtros/anios?marca=KIA&modelo=RIO - lista de anios disponibles
export default defineEventHandler(async (event) => {
  const q = getQuery(event)

  const where: Prisma.ProductoMvWhereInput = { anio: { not: null }, vendido: false }
  if (q.marca) where.marca = String(q.marca)
  if (q.modelo) where.modelo = String(q.modelo)

  const rows = await prisma.productoMv.findMany({
    where,
    distinct: ['anio'],
    select: { anio: true },
    orderBy: { anio: 'asc' },
  })
  return rows.map((r) => r.anio).filter(Boolean)
})
