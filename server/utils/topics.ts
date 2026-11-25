import { topicMomentum } from '~~/shared/home'
import type { Topic } from '~~/shared/outliers'

/** Cada tema gasta unas 150 unidades por refresco, así que se limita cuántos puedes seguir. */
export const MAX_TOPICS = 8

/** Busca un tema en YouTube, puntúa lo que encuentra y guarda el resultado. Devuelve cuántos videos trajo. */
export async function refreshTopic(topic: Topic): Promise<number> {
  const ids = await searchVideoIds({
    query: topic.query,
    days: topic.days,
    categoryId: topic.categoryId,
    language: topic.language,
    order: 'relevance',
  })
  const found = ids.length > 0 ? await fetchVideosByIds(ids) : []
  const scored = found.length > 0 ? await scoreFoundVideos(found) : { channels: [], videos: [], context: {} }
  // "followed" se recalcula al leer: cambia cada vez que sigues o dejas de seguir un canal.
  const channels = scored.channels.map(({ followed: _followed, ...channel }) => channel)
  await dbSaveTopicResults(topic.id, { channels, videos: scored.videos }, scored.context)
  // Una foto por día del impulso del tema (ver shared/home.ts): la última actualización del día gana.
  await dbSaveTopicSnapshot(topic.id, topicMomentum(scored.videos))
  return scored.videos.length
}
