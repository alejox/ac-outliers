/** Guarda un video por su ID. Desde la app y desde la extensión del navegador. */
export default defineEventHandler(async (event) => {
  requireLive()
  const body = await readBody<{ id?: unknown; short?: unknown }>(event)
  const id = typeof body?.id === 'string' && /^[\w-]{11}$/.test(body.id) ? body.id : null
  if (!id) throw createError({ statusCode: 400, message: 'Falta el ID del video.' })
  const video = await saveVideoById(id, body?.short === true)
  return { ok: true, video }
})
