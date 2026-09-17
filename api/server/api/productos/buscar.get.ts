import { buscarProductos } from '~/server/utils/buscarProductos'

// GET /api/productos/buscar - alias explicito de busqueda/filtrado (mismo comportamiento que GET /api/productos).
// Filtros: categoria, marca, modelo, anio, lado, codigo (# de pieza), vendido, q (texto libre).
// Paginacion: page (1-based), pageSize.
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  return buscarProductos(q as Record<string, string>)
})
