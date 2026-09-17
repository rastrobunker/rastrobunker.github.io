import { prisma } from '~/server/utils/prisma'

// GET /api/filtros/categorias - lista de categorias disponibles (para nav-cats)
export default defineEventHandler(async () => {
  const rows = await prisma.productoMv.findMany({
    where: { categoria: { not: null }, vendido: false },
    distinct: ['categoria'],
    select: { categoria: true },
    orderBy: { categoria: 'asc' },
  })
  return rows.map((r) => r.categoria).filter(Boolean)
})
