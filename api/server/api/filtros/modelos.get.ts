import { prisma } from '~/server/utils/prisma'
import type { Prisma } from '@prisma/client'

// GET /api/filtros/modelos?marca=KIA - lista de modelos, opcionalmente filtrada por marca
export default defineEventHandler(async (event) => {
  const q = getQuery(event)

  const where: Prisma.ProductoMvWhereInput = { modelo: { not: null }, vendido: false }
  if (q.marca) where.marca = String(q.marca)

  const rows = await prisma.productoMv.findMany({
    where,
    distinct: ['modelo'],
    select: { modelo: true },
    orderBy: { modelo: 'asc' },
  })
  return rows.map((r) => r.modelo).filter(Boolean)
})
