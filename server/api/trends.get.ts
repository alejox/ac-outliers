import { refreshAges, type Channel, type ScoredVideo } from '~~/shared/outliers'

/**
 * Lo que está pegando en los temas que sigues. Lee resultados guardados: no gasta cuota.
 * Cada video trae los temas en los que apareció.
 */
export default defineEventHandler(async (event) => {
  const demo = appMode() === 'demo'
  const [topics, followed] = demo
    ? [demoTopics(), demoData().channels]
    : await currentUserId(event).then((userId) => Promise.all([dbListTopics(userId), dbListChannels(userId)]))
  const followedById = new Map(followed.map((c) => [c.id, c]))

  const channels = new Map<string, Channel & { followed: boolean }>()
  const videos = new Map<string, ScoredVideo & { topicIds: string[] }>()
  for (const topic of topics) {
    for (const channel of topic.results?.channels ?? []) {
      // Lo guardado no sabe si después lo seguiste o lo marcaste como tuyo: eso se lee de tus canales.
      const mine = followedById.get(channel.id)
      channels.set(channel.id, { ...channel, isMine: mine?.isMine ?? false, followed: mine !== undefined })
    }
    for (const video of refreshAges(topic.results?.videos ?? [])) {
      const seen = videos.get(video.id)
      if (seen) seen.topicIds.push(topic.id)
      else videos.set(video.id, { ...video, topicIds: [topic.id] })
    }
  }

  return {
    topics: topics.map(({ id, query, categoryId, language, days, fetchedAt, results }) => ({
      id, query, categoryId, language, days, fetchedAt, count: results?.videos.length ?? 0,
    })),
    channels: [...channels.values()],
    videos: [...videos.values()],
  }
})
