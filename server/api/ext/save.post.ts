/** Guarda o quita un video desde la extensión. */
export default defineEventHandler(async (event) => {
  if (appMode() === 'demo') {
    throw createError({ statusCode: 400, message: 'En modo demo no se puede guardar. Configura tus claves en la app.' })
  }
  const body = await readBody<{ id?: unknown; short?: unknown; saved?: unknown }>(event)
  const id = typeof body?.id === 'string' && /^[\w-]{11}$/.test(body.id) ? body.id : null
  if (!id) throw createError({ statusCode: 400, message: 'Falta el ID del video.' })
  const userId = await currentUserId(event)
  if (body?.saved === false) {
    await dbUnsaveVideo(userId, id)
    return { saved: false }
  }
  await saveVideoById(userId, id, body?.short === true)
  return { saved: true }
})
