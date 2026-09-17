import { prisma } from '~/server/utils/prisma'
import { upsertProductoMv } from '~/server/utils/productoMv'
import { requireAdmin } from '~/server/utils/requireAdmin'

// POST /api/productos/:id/vender - reduce la cantidad disponible al vender una pieza.
// Body opcional: { cantidad?: number } (por defecto 1). Marca vendido=true al llegar a 0.
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id requerido' })

  const body = await readBody(event).catch(() => ({} as Record<string, unknown>))
  const cantidadVendida = Math.max(1, Number((body as Record<string, unknown>)?.cantidad) || 1)

  const producto = await prisma.producto.findUnique({ where: { id } })
  if (!producto) throw createError({ statusCode: 404, statusMessage: 'Producto no encontrado' })
  if (producto.vendido) throw createError({ statusCode: 409, statusMessage: 'El producto ya esta vendido' })

  const disponible = producto.cantidad ?? 1
  if (cantidadVendida > disponible) {
    throw createError({ statusCode: 400, statusMessage: `Solo hay ${disponible} unidad(es) disponible(s)` })
  }

  const nuevaCantidad = disponible - cantidadVendida

  const actualizado = await prisma.producto.update({
    where: { id },
    data: {
      cantidad: nuevaCantidad,
      vendido: nuevaCantidad <= 0,
    },
  })

  await upsertProductoMv(actualizado)

  return actualizado
})
