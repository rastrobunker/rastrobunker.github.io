import { prisma } from '~/server/utils/prisma'

// GET /api/filtros - todas las opciones de filtro en una sola llamada
// (categoria, marca, modelo, anio, lado) para poblar los selects del catalogo.
export default defineEventHandler(async () => {
  const base = { vendido: false } as const

  const [categorias, marcas, modelos, anios, lados] = await Promise.all([
    prisma.productoMv.findMany({ where: { ...base, categoria: { not: null } }, distinct: ['categoria'], select: { categoria: true }, orderBy: { categoria: 'asc' } }),
    prisma.productoMv.findMany({ where: { ...base, marca: { not: null } }, distinct: ['marca'], select: { marca: true }, orderBy: { marca: 'asc' } }),
    prisma.productoMv.findMany({ where: { ...base, modelo: { not: null } }, distinct: ['modelo'], select: { modelo: true }, orderBy: { modelo: 'asc' } }),
    prisma.productoMv.findMany({ where: { ...base, anio: { not: null } }, distinct: ['anio'], select: { anio: true }, orderBy: { anio: 'asc' } }),
    prisma.productoMv.findMany({ where: { ...base, lado: { not: null } }, distinct: ['lado'], select: { lado: true }, orderBy: { lado: 'asc' } }),
  ])

  return {
    categorias: categorias.map((r) => r.categoria).filter(Boolean),
    marcas: marcas.map((r) => r.marca).filter(Boolean),
    modelos: modelos.map((r) => r.modelo).filter(Boolean),
    anios: anios.map((r) => r.anio).filter(Boolean),
    lados: lados.map((r) => r.lado).filter(Boolean),
  }
})
