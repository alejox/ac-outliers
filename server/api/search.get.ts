import { scoreVideos, type Video } from '~~/shared/outliers'

/** Por encima de esto un video no puede ser un Short. */
const MAX_SHORT_SECONDS = 180
const PERIODS = [7, 30, 90, 365]

async function inBatches<T>(items: T[], size: number, run: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(run))
  }
}

/**
 * Descubre videos por tema en todo YouTube y los puntúa contra lo normal de su canal.
 * No guarda nada: los resultados viven en el navegador hasta que sigas un canal.
 * Solo considera videos largos. Cuesta 100 unidades de la búsqueda más unas 2 por canal encontrado.
 */
export default defineEventHandler(async (event) => {
  requireLive()
  const params = getQuery(event)
  const q = String(params.q ?? '').trim().slice(0, 80)
  const days = PERIODS.includes(Number(params.days)) ? Number(params.days) : 0
  if (q.length < 2) {
    throw createError({ statusCode: 400, message: 'Escribe un tema para buscar.' })
  }

  const ids = await searchVideoIds(q, days)
  let quotaUsed = 100
  if (ids.length === 0) return { channels: [], videos: [], quotaUsed }

  const found = await fetchVideosByIds(ids)
  const channelIds = [...new Set(found.map((v) => v.channelId))]
  const [followed, channels] = await Promise.all([dbListChannels(), fetchChannelsByIds(channelIds)])
  quotaUsed += 2

  // Los videos recientes de cada canal dan la referencia de qué es normal en él.
  const recent = new Map<string, Video>()
  await inBatches(channelIds, 5, async (channelId) => {
    for (const video of await fetchLongVideos(channelId)) recent.set(video.id, video)
  })
  quotaUsed += channelIds.length * 2

  // Un resultado corto que no está entre los videos largos del canal es un Short: se descarta.
  const results = found.filter((v) => v.durationSeconds > MAX_SHORT_SECONDS || recent.has(v.id))
  const resultIds = new Set(results.map((v) => v.id))
  for (const video of results) recent.set(video.id, video)

  const followedIds = new Set(followed.map((c) => c.id))
  return {
    channels: channels.map((c) => ({ ...c, followed: followedIds.has(c.id) })),
    videos: scoreVideos([...recent.values()]).filter((v) => resultIds.has(v.id)),
    quotaUsed,
  }
})
