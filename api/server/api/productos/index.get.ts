import { buscarProductos } from '~/server/utils/buscarProductos'

// GET /api/productos
// Filtros: categoria, marca, modelo, anio, lado, codigo, vendido, q (busqueda libre)
// Paginacion: page (1-based), pageSize
// Equivalente a GET /api/productos/buscar (alias explicito de busqueda).
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  return buscarProductos(q as Record<string, string>)
})
