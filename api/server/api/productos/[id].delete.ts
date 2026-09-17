import { prisma } from '~/server/utils/prisma'
import { deleteProductoMv } from '~/server/utils/productoMv'
import { requireAdmin } from '~/server/utils/requireAdmin'

// DELETE /api/productos/:id - borrar pieza
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id requerido' })

  const existente = await prisma.producto.findUnique({ where: { id } })
  if (!existente) throw createError({ statusCode: 404, statusMessage: 'Producto no encontrado' })

  await prisma.producto.delete({ where: { id } })
  await deleteProductoMv(id)

  setResponseStatus(event, 204)
  return null
})
