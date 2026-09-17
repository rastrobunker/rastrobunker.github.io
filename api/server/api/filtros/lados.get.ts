import { prisma } from '~/server/utils/prisma'

// GET /api/filtros/lados - lados disponibles (RH/LH/etc.)
export default defineEventHandler(async () => {
  const rows = await prisma.productoMv.findMany({
    where: { lado: { not: null }, vendido: false },
    distinct: ['lado'],
    select: { lado: true },
    orderBy: { lado: 'asc' },
  })
  return rows.map((r) => r.lado).filter(Boolean)
})
