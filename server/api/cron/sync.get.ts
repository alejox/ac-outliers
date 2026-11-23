/**
 * Actualización diaria de todos los canales (la llama el cron de Vercel, ver vercel.json).
 * Es lo que construye el historial de vistas aunque nadie abra la app.
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
  return { synced: channels.length - failed.length, failed }
})
