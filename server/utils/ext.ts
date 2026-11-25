import {
  baselineKey,
  channelBaseline,
  isBaselineFresh,
  scoreAgainst,
  type Baseline,
  type ExtScore,
  type VideoRequest,
} from '~~/shared/extension'
import { scoreVideos, type ScoredVideo, type Video } from '~~/shared/outliers'

/** Un canal seguido con sus videos al día no necesita volver a YouTube: se calcula con lo guardado. */
const SYNC_FRESH_HOURS = 48

async function inBatches<T>(items: T[], size: number, run: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(run))
  }
}

/**
 * Trae unos videos por ID y lo normal de su canal en su formato.
 * Cuesta 1 unidad por los videos, y 2 por cada canal y formato que no se haya calculado en el último día.
 */
export async function videosWithBaselines(
  requests: VideoRequest[],
): Promise<{ items: { video: Video; baseline: number | null }[]; quotaUsed: number }> {
  if (requests.length === 0) return { items: [], quotaUsed: 0 }
  const now = new Date()
  const shortById = new Map(requests.map((r) => [r.id, r.short]))
  const videos = (await fetchVideosByIds(requests.map((r) => r.id))).map((v) => ({ ...v, isShort: shortById.get(v.id) ?? false }))
  let quotaUsed = 1

  const keys = new Map<string, { channelId: string; short: boolean }>()
  for (const v of videos) keys.set(baselineKey(v.channelId, v.isShort), { channelId: v.channelId, short: v.isShort })
  const channelIds = [...new Set([...keys.values()].map((k) => k.channelId))]

  const known = new Map<string, Baseline>()
  for (const b of await dbListBaselines(channelIds)) {
    if (isBaselineFresh(b.computedAt, now)) known.set(baselineKey(b.channelId, b.short), b)
  }

  const missing = [...keys.entries()].filter(([key]) => !known.has(key)).map(([, k]) => k)
  if (missing.length > 0) {
    const followed = new Map((await dbListChannels()).map((c) => [c.id, c]))
    const computed: Baseline[] = []
    const savedVideos = new Map<string, Promise<Video[]>>()

    await inBatches(missing, 5, async ({ channelId, short }) => {
      const channel = followed.get(channelId)
      const synced = channel?.lastSyncedAt && now.getTime() - new Date(channel.lastSyncedAt).getTime() < SYNC_FRESH_HOURS * 3_600_000
      let source: Video[]
      if (synced) {
        if (!savedVideos.has(channelId)) savedVideos.set(channelId, dbListChannelVideos(channelId))
        source = await savedVideos.get(channelId)!
      } else {
        source = short ? await fetchShortVideos(channelId) : await fetchLongVideos(channelId)
        quotaUsed += 2
      }
      const { median, sample } = channelBaseline(source, short, now)
      const baseline = { channelId, short, median, sample, computedAt: now.toISOString() }
      computed.push(baseline)
      known.set(baselineKey(channelId, short), baseline)
    })
    await dbSaveBaselines(computed)
  }

  return {
    items: videos.map((video) => ({ video, baseline: known.get(baselineKey(video.channelId, video.isShort))?.median ?? null })),
    quotaUsed,
  }
}

/** Puntúa los videos que la extensión ve en YouTube contra lo normal de su canal. */
export async function scoreForExtension(requests: VideoRequest[]): Promise<{ scores: ExtScore[]; quotaUsed: number }> {
  const { items, quotaUsed } = await videosWithBaselines(requests)
  const scores = items.map(({ video, baseline }) => ({
    id: video.id,
    channelId: video.channelId,
    short: video.isShort,
    views: video.views,
    baseline,
    score: scoreAgainst(video.views, baseline),
  }))
  return { scores, quotaUsed }
}

/**
 * Guarda un video por su ID con su score de hoy. Los de canales que sigues se toman de lo ya guardado;
 * los demás cuestan 1 unidad por el video, 1 por el canal y 2 si su canal no se calculó hoy.
 */
export async function saveVideoById(id: string, short: boolean): Promise<ScoredVideo> {
  const { items } = await videosWithBaselines([{ id, short }])
  const item = items[0]
  if (!item) throw createError({ statusCode: 404, message: 'YouTube no devolvió ese video: puede ser privado o estar en vivo.' })
  const [scored] = scoreVideos([item.video])
  const video: ScoredVideo = { ...scored!, baseline: item.baseline, score: scoreAgainst(item.video.views, item.baseline) }
  const followed = (await dbListChannels()).find((c) => c.id === video.channelId)
  const channel = followed ?? (await fetchChannelsByIds([video.channelId]))[0] ?? null
  await dbSaveVideo(video, channel)
  return video
}
