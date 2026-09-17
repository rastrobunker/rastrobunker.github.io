import { prisma } from '~/server/utils/prisma'
import type { Prisma } from '@prisma/client'

export interface BuscarProductosQuery {
  categoria?: string
  marca?: string
  modelo?: string
  anio?: string
  lado?: string
  codigo?: string
  vendido?: string | boolean
  q?: string
  page?: string | number
  pageSize?: string | number
}

// Busca piezas en productos_mv por categoria, marca, modelo, anio, lado, codigo (# de pieza),
// vendido, y texto libre (q) sobre codigo/alias/marca/modelo/categoria/detalle. Con paginacion.
export async function buscarProductos(query: BuscarProductosQuery) {
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 30))

  const where: Prisma.ProductoMvWhereInput = {}
  if (query.categoria) where.categoria = String(query.categoria)
  if (query.marca) where.marca = String(query.marca)
  if (query.modelo) where.modelo = String(query.modelo)
  if (query.anio) where.anio = String(query.anio)
  if (query.lado) where.lado = String(query.lado)
  if (query.codigo) where.codigo = { contains: String(query.codigo) }
  if (query.vendido !== undefined) where.vendido = query.vendido === 'true' || query.vendido === '1' || query.vendido === true

  if (query.q) {
    const texto = String(query.q)
    where.OR = [
      { codigo: { contains: texto } },
      { alias: { contains: texto } },
      { marca: { contains: texto } },
      { modelo: { contains: texto } },
      { categoria: { contains: texto } },
    ]
  }

  const [total, items] = await Promise.all([
    prisma.productoMv.count({ where }),
    prisma.productoMv.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { updatedAt: 'desc' },
    }),
  ])

  return {
    data: items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  }
}
