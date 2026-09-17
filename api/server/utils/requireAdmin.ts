// Guardia para operaciones de administrador: exige el header x-admin-code igual a ADMIN_CODE (.env).
export function requireAdmin(event: any) {
  const codigo = getHeader(event, 'x-admin-code')
  if (!codigo || codigo !== process.env.ADMIN_CODE) {
    throw createError({ statusCode: 401, statusMessage: 'Codigo de administrador invalido' })
  }
}
