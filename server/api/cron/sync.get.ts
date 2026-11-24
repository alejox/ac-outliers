/**
 * Actualización diaria de todos los canales y temas (la llama el cron de Vercel, ver vercel.json).
 * Es lo que construye el historial de vistas y mantiene las tendencias frescas aunque nadie abra la app.
 * Vercel envía "Authorization: Bearer <CRON_SECRET>" si defines esa variable de entorno.
 */
export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET
  if (!secret || getHeader(event, 'authorization') !== `Bearer ${secret}`) {
    throw createError({ statusCode: 401, message: 'No autorizado.' })
  }
  requireLive()

  const channels = await dbListChannels()
  const failed: string[] = []
  for (const channel of channels) {
    try {
      await syncChannel(channel.id)
    } catch {
      failed.push(channel.title)
    }
  }
  // Los temas van después: si la cuota se agota, los canales ya quedaron al día.
  const topics = await dbListTopics()
  for (const topic of topics) {
    try {
      await refreshTopic(topic)
    } catch {
      failed.push(topic.query || topic.categoryId)
    }
  }
  return { synced: channels.length + topics.length - failed.length, failed }
})
