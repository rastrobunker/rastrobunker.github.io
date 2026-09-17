import { prisma } from '~/server/utils/prisma'
import { requireAdmin } from '~/server/utils/requireAdmin'

// POST /api/productos/mv/refresh - reconstruye productos_mv por completo desde productos.
// Util tras cargas masivas (ej. insert_productos.sql) o si se sospecha que quedo desincronizada.
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  await prisma.$executeRawUnsafe('CALL sp_refresh_productos_mv()')
  const total = await prisma.productoMv.count()
  return { ok: true, total }
})
