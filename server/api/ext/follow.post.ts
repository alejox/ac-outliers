/** Sigue un canal desde la extensión, igual que agregarlo en la app (unas 5 unidades). */
export default defineEventHandler(async (event) => {
  if (appMode() === 'demo') {
    throw createError({ statusCode: 400, message: 'En modo demo no se pueden seguir canales. Configura tus claves en la app.' })
  }
  const body = await readBody<{ channelId?: unknown }>(event)
  const channelId = typeof body?.channelId === 'string' && /^UC[\w-]{22}$/.test(body.channelId) ? body.channelId : null
  if (!channelId) throw createError({ statusCode: 400, message: 'Falta el ID del canal.' })
  const userId = await currentUserId(event)
  if ((await dbListChannels(userId)).some((c) => c.id === channelId)) return { followed: true }
  const known = (await dbListCatalogChannels()).find((c) => c.id === channelId)
  if (!known) {
    const channel = await fetchChannel({ id: channelId })
    if (!channel) throw createError({ statusCode: 404, message: 'No encontré ese canal en YouTube.' })
    await syncChannel(channel.id, channel)
  }
  await dbFollowChannel(userId, channelId)
  return { followed: true }
})
