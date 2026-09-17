import { prisma } from '~/server/utils/prisma'

// GET /api/productos/:id/foto - sirve la imagen decodificada desde el data URI guardado en `foto`.
// Se separa del detalle para que el listado (productos_mv) no tenga que cargar el base64.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id requerido' })

  const producto = await prisma.producto.findUnique({ where: { id }, select: { foto: true } })
  if (!producto?.foto) throw createError({ statusCode: 404, statusMessage: 'Sin foto' })

  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(producto.foto)
  if (!match) throw createError({ statusCode: 500, statusMessage: 'Formato de foto invalido' })

  setResponseHeader(event, 'Content-Type', match[1])
  setResponseHeader(event, 'Cache-Control', 'public, max-age=86400')
  return Buffer.from(match[2], 'base64')
})
