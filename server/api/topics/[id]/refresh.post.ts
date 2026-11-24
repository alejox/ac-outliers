/** Vuelve a buscar un tema en YouTube. Cuesta unas 150 unidades. */
export default defineEventHandler(async (event) => {
  requireLive()
  const topic = await dbGetTopic(getRouterParam(event, 'id')!)
  if (!topic) throw createError({ statusCode: 404, message: 'Ese tema ya no existe.' })
  return { videos: await refreshTopic(topic) }
})
