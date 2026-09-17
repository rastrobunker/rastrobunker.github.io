import { prisma } from '~/server/utils/prisma'

// GET /api/filtros/marcas - lista de marcas disponibles (para brands-grid)
export default defineEventHandler(async () => {
  const rows = await prisma.productoMv.findMany({
    where: { marca: { not: null }, vendido: false },
    distinct: ['marca'],
    select: { marca: true },
    orderBy: { marca: 'asc' },
  })
  return rows.map((r) => r.marca).filter(Boolean)
})
