import { prisma } from '~/server/utils/prisma'

// GET /api/productos/:id - detalle completo (incluye foto)
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id requerido' })

  const producto = await prisma.producto.findUnique({ where: { id } })
  if (!producto) throw createError({ statusCode: 404, statusMessage: 'Producto no encontrado' })

  return producto
})
