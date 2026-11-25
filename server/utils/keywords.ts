import { outlierKeywords, type Keyword } from '~~/shared/keywords'
import { scoreVideos } from '~~/shared/outliers'

const TTL = 10 * 60_000
const cache = new Map<string, { at: number; tags: Keyword[] }>()

/**
 * Las etiquetas de los outliers de tus canales, para la extensión. Se guardan 10 minutos en memoria:
 * la extensión las pide en cada video que abres y cambian solo cuando se actualizan los datos.
 */
export async function userTagKeywords(userId: string): Promise<Keyword[]> {
  const hit = cache.get(userId)
  if (hit && Date.now() - hit.at < TTL) return hit.tags
  const [list, previous] = await Promise.all([dbListVideos(userId), dbListPreviousReadings()])
  const videos = scoreVideos(list, new Date(), previous)
  const tags = await dbListVideoTags(videos.map((v) => v.id))
  const result = outlierKeywords(
    videos.map((v) => ({ id: v.id, title: v.title, score: v.score, tags: tags.get(v.id) ?? null })),
    'tags',
    { limit: 60 },
  )
  cache.set(userId, { at: Date.now(), tags: result })
  return result
}
