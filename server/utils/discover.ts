import { scoreVideos, type Video } from '~~/shared/outliers'

/** Por encima de esto un video no puede ser un Short. */
const MAX_SHORT_SECONDS = 180

async function inBatches<T>(items: T[], size: number, run: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(run))
  }
}

function groupByChannel(videos: Video[]): Record<string, Video[]> {
  const out: Record<string, Video[]> = {}
  for (const v of videos) (out[v.channelId] ??= []).push(v)
  return out
}

/**
 * Puntúa videos encontrados fuera de tus canales contra lo normal de su propio canal.
 * No guarda nada. Solo considera videos largos. Cuesta unas 2 unidades por canal distinto.
 */
export async function scoreFoundVideos(found: Video[]) {
  const channelIds = [...new Set(found.map((v) => v.channelId))]
  const [followed, channels] = await Promise.all([dbListChannels(), fetchChannelsByIds(channelIds)])

  // Los videos recientes de cada canal dan la referencia de qué es normal en él.
  const recent = new Map<string, Video>()
  await inBatches(channelIds, 5, async (channelId) => {
    for (const video of await fetchLongVideos(channelId)) recent.set(video.id, video)
  })

  // Un resultado corto que no está entre los videos largos del canal es un Short: se descarta.
  const results = found.filter((v) => v.durationSeconds > MAX_SHORT_SECONDS || recent.has(v.id))
  const resultIds = new Set(results.map((v) => v.id))
  for (const video of results) recent.set(video.id, video)

  const followedIds = new Set(followed.map((c) => c.id))
  const scored = scoreVideos([...recent.values()])
  return {
    channels: channels.map((c) => ({ ...c, followed: followedIds.has(c.id) })),
    videos: scored.filter((v) => resultIds.has(v.id)),
    // Los videos largos recientes de cada canal, ya leídos para puntuar: con ellos se analiza un
    // resultado frente a su canal sin gastar más cuota. Sin miniaturas, que aquí no se muestran.
    context: groupByChannel([...recent.values()].map((v) => ({ ...v, thumbnailUrl: null }))),
    scoredContext: scored,
    quotaUsed: 1 + channelIds.length * 2,
  }
}
