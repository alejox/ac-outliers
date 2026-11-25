import { parseChannelInput } from '~~/shared/channel-input'

/** Agrega un canal a partir de su @usuario, enlace o ID, y trae sus videos. */
export default defineEventHandler(async (event) => {
  requireLive()
  const body = await readBody<{ input?: string }>(event)

  const ref = parseChannelInput(body?.input ?? '')
  if (!ref) {
    throw createError({
      statusCode: 400,
      message: 'No reconozco ese canal. Pega su @usuario, el enlace del canal o su ID (empieza por UC).',
    })
  }

  const channel = await fetchChannel(ref)
  if (!channel) {
    throw createError({
      statusCode: 404,
      message: 'No encontré ese canal en YouTube. Revisa que el @usuario esté bien escrito.',
    })
  }

  // Si otra persona ya sigue el canal y está al día, no se vuelve a pedir a YouTube.
  const known = (await dbListCatalogChannels()).find((c) => c.id === channel.id)
  const recent = known?.lastSyncedAt && Date.now() - new Date(known.lastSyncedAt).getTime() < 12 * 3_600_000
  const videos = recent ? (await dbListChannelVideos(channel.id)).length : await syncChannel(channel.id, channel)
  await dbFollowChannel(await currentUserId(event), channel.id)
  return { channel, videos }
})
