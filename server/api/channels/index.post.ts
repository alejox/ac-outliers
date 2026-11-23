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

  await dbSaveChannel(channel)
  const videos = await syncChannel(channel.id)
  return { channel, videos }
})
