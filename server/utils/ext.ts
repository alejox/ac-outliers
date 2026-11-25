import {
  baselineKey,
  channelBaseline,
  isBaselineFresh,
  scoreAgainst,
  type Baseline,
  type ExtScore,
  type VideoRequest,
} from '~~/shared/extension'
import type { Video } from '~~/shared/outliers'

/** Un canal seguido con sus videos al día no necesita volver a YouTube: se calcula con lo guardado. */
const SYNC_FRESH_HOURS = 48

async function inBatches<T>(items: T[], size: number, run: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(run))
  }
}

/**
 * Puntúa los videos que la extensión ve en YouTube contra lo normal de su canal.
 * Cuesta 1 unidad por los videos, y 2 por cada canal y formato que no se haya calculado en el último día.
 */
export async function scoreForExtension(requests: VideoRequest[]): Promise<{ scores: ExtScore[]; quotaUsed: number }> {
  if (requests.length === 0) return { scores: [], quotaUsed: 0 }
  const now = new Date()
  const shortById = new Map(requests.map((r) => [r.id, r.short]))
  const videos = await fetchVideosByIds(requests.map((r) => r.id))
  let quotaUsed = 1

  const keys = new Map<string, { channelId: string; short: boolean }>()
  for (const v of videos) {
    const short = shortById.get(v.id) ?? false
    keys.set(baselineKey(v.channelId, short), { channelId: v.channelId, short })
  }
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

  const scores = videos.map((v) => {
    const short = shortById.get(v.id) ?? false
    const baseline = known.get(baselineKey(v.channelId, short))?.median ?? null
    return { id: v.id, channelId: v.channelId, short, views: v.views, baseline, score: scoreAgainst(v.views, baseline) }
  })
  return { scores, quotaUsed }
}
