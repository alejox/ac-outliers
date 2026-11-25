import { scoreVideos, type ScoredVideo } from '~~/shared/outliers'

/**
 * Los videos guardados de un canal, ya puntuados, para el panel "Analizar".
 * Sirve para canales que sigues y para los que aparecen en tus temas (sus videos de referencia
 * se guardaron al buscar el tema). Solo lee lo guardado: no gasta cuota.
 */
export default defineEventHandler(async (event): Promise<{ videos: ScoredVideo[] }> => {
  const id = String(getQuery(event).id ?? '')
  if (!id) throw createError({ statusCode: 400, message: 'Falta el canal.' })

  if (appMode() === 'demo') {
    const { videos } = demoData()
    const own = videos.filter((v) => v.channelId === id)
    if (own.length > 0) return { videos: scoreVideos(own) }
    for (const topic of demoTopics()) if (topic.context[id]) return { videos: topic.context[id]! }
    return { videos: [] }
  }

  const own = await dbListChannelVideos(id)
  if (own.length > 0) return { videos: scoreVideos(own) }
  return { videos: scoreVideos(await dbFindTopicContext(id)) }
})
