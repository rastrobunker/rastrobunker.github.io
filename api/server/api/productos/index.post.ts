import { prisma } from '~/server/utils/prisma'
import { upsertProductoMv } from '~/server/utils/productoMv'
import { requireAdmin } from '~/server/utils/requireAdmin'

// POST /api/productos - crear pieza
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const body = await readBody(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Body invalido' })
  }

  const producto = await prisma.producto.create({
    data: {
      idLegacy: body.idLegacy ?? null,
      codigo: body.codigo ?? null,
      categoria: body.categoria ?? null,
      marca: body.marca ?? null,
      modelo: body.modelo ?? null,
      anio: body.anio ?? null,
      lado: body.lado ?? null,
      condicion: body.condicion ?? null,
      precio: body.precio ?? null,
      vendido: Boolean(body.vendido),
      cantidad: body.cantidad ?? null,
      detalle: body.detalle ?? null,
      posicion: body.posicion ?? null,
      bgc: body.bgc ?? null,
      fit: body.fit ?? null,
      alias: body.alias ?? null,
      foto: body.foto ?? null,
    },
  })

  await upsertProductoMv(producto)

  setResponseStatus(event, 201)
  return producto
})
