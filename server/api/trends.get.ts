import { refreshAges, type Channel, type ScoredVideo } from '~~/shared/outliers'

/**
 * Lo que está pegando en los temas que sigues. Lee resultados guardados: no gasta cuota.
 * Cada video trae los temas en los que apareció.
 */
export default defineEventHandler(async () => {
  if (appMode() === 'demo') return { topics: [], channels: [], videos: [] }

  const [topics, followed] = await Promise.all([dbListTopics(), dbListChannels()])
  const followedIds = new Set(followed.map((c) => c.id))

  const channels = new Map<string, Channel & { followed: boolean }>()
  const videos = new Map<string, ScoredVideo & { topicIds: string[] }>()
  for (const topic of topics) {
    for (const channel of topic.results?.channels ?? []) {
      channels.set(channel.id, { ...channel, followed: followedIds.has(channel.id) })
    }
    for (const video of refreshAges(topic.results?.videos ?? [])) {
      const seen = videos.get(video.id)
      if (seen) seen.topicIds.push(topic.id)
      else videos.set(video.id, { ...video, topicIds: [topic.id] })
    }
  }

  return {
    topics: topics.map(({ results, ...topic }) => ({ ...topic, count: results?.videos.length ?? 0 })),
    channels: [...channels.values()],
    videos: [...videos.values()],
  }
})
