import { outlierKeywords, titlePhrases } from '~~/shared/keywords'
import { demoTags } from '~~/shared/extension'
import { scoreVideos, type ScoredVideo } from '~~/shared/outliers'

/**
 * Palabras de los outliers de tus canales (o de uno): las etiquetas y las frases de título que más
 * comparten los videos que rindieron 2× o más. Lee lo guardado: no gasta cuota.
 */
export default defineEventHandler(async (event) => {
  const channel = String(getQuery(event).channel ?? '')
  let videos: ScoredVideo[]
  let tags: Map<string, string[]>
  if (appMode() === 'demo') {
    videos = scoreVideos(demoData().videos)
    // Los datos de ejemplo no traen etiquetas: se arman con las frases del título y unas comunes.
    tags = new Map(
      videos.map((v) => [v.id, [...titlePhrases(v.title).filter((p) => p.key.includes(' ')).slice(0, 3).map((p) => p.text), ...demoTags(v.id).slice(0, 1)]]),
    )
  } else {
    const userId = await currentUserId(event)
    const [list, previous] = await Promise.all([dbListVideos(userId), dbListPreviousReadings()])
    videos = scoreVideos(list, new Date(), previous)
    tags = await dbListVideoTags(videos.map((v) => v.id))
  }
  if (channel) videos = videos.filter((v) => v.channelId === channel)
  const input = videos.map((v) => ({ id: v.id, title: v.title, score: v.score, tags: tags.get(v.id) ?? null }))
  return {
    tags: outlierKeywords(input, 'tags'),
    titles: outlierKeywords(input, 'titles'),
    withTags: input.filter((v) => v.tags && v.tags.length > 0).length,
    total: input.length,
  }
})
