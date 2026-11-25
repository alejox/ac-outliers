/** Vuelve a buscar un tema en YouTube. Cuesta unas 150 unidades. */
export default defineEventHandler(async (event) => {
  requireLive()
  const id = getRouterParam(event, 'id')!
  const topic = (await dbFollowsTopic(await currentUserId(event), id)) ? await dbGetTopic(id) : null
  if (!topic) throw createError({ statusCode: 404, message: 'Ese tema ya no existe.' })
  return { videos: await refreshTopic(topic) }
})
