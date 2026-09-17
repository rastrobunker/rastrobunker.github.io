// POST /api/admin/verificar - valida el codigo ingresado en el modal contra ADMIN_CODE (.env).
// El codigo real nunca se envia al cliente; solo se responde ok:true/false.
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}) as Record<string, unknown>)
  const codigo = String((body as Record<string, unknown>)?.codigo || '')

  if (!codigo || codigo !== process.env.ADMIN_CODE) {
    throw createError({ statusCode: 401, statusMessage: 'Codigo incorrecto' })
  }

  return { ok: true }
})
