/** Crea una colección para agrupar guardados. */
export default defineEventHandler(async (event) => {
  requireLive()
  const body = await readBody<{ name?: unknown }>(event)
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
  if (name.length < 1 || name.length > 40) {
    throw createError({ statusCode: 400, message: 'Ponle a la colección un nombre de hasta 40 caracteres.' })
  }
  return { collection: await dbCreateCollection(name) }
})
