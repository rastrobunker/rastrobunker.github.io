import { prisma } from '~/server/utils/prisma'
import { upsertProductoMv } from '~/server/utils/productoMv'
import { requireAdmin } from '~/server/utils/requireAdmin'

// PUT /api/productos/:id - editar pieza
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id requerido' })

  const existente = await prisma.producto.findUnique({ where: { id } })
  if (!existente) throw createError({ statusCode: 404, statusMessage: 'Producto no encontrado' })

  const body = await readBody(event)

  const producto = await prisma.producto.update({
    where: { id },
    data: {
      codigo: body.codigo ?? existente.codigo,
      categoria: body.categoria ?? existente.categoria,
      marca: body.marca ?? existente.marca,
      modelo: body.modelo ?? existente.modelo,
      anio: body.anio ?? existente.anio,
      lado: body.lado ?? existente.lado,
      condicion: body.condicion ?? existente.condicion,
      precio: body.precio ?? existente.precio,
      vendido: body.vendido ?? existente.vendido,
      cantidad: body.cantidad ?? existente.cantidad,
      detalle: body.detalle ?? existente.detalle,
      posicion: body.posicion ?? existente.posicion,
      bgc: body.bgc ?? existente.bgc,
      fit: body.fit ?? existente.fit,
      alias: body.alias ?? existente.alias,
      foto: body.foto ?? existente.foto,
    },
  })

  await upsertProductoMv(producto)

  return producto
})
