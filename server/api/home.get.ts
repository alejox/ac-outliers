import { topicMomentum, type MomentumPoint } from '~~/shared/home'
import type { ChannelSnapshot } from '~~/shared/achievements'

/** Días de impulso que muestra Inicio. */
const DAYS = 14

/**
 * Lo que Inicio necesita además de canales y temas: el impulso diario de cada tema y el historial
 * de los canales que marcaste como tuyos. Solo lee lo guardado: no gasta cuota.
 */
export default defineEventHandler(async () => {
  if (appMode() === 'demo') {
    const momentum: Record<string, MomentumPoint[]> = {}
    for (const t of demoTopics()) momentum[t.id] = t.momentum
    return { momentum, history: demoHistory() }
  }

  const since = new Date(Date.now() - (DAYS - 1) * 86_400_000).toISOString().slice(0, 10)
  const [topics, channels, snapshots] = await Promise.all([dbListTopics(), dbListChannels(), dbListTopicSnapshots(since)])

  const momentum: Record<string, MomentumPoint[]> = {}
  for (const topic of topics) {
    const series = snapshots.get(topic.id) ?? []
    // Un tema refrescado antes de que existiera el historial: su único punto sale de los resultados guardados.
    if (series.length === 0 && topic.results && topic.fetchedAt) {
      series.push({ date: topic.fetchedAt.slice(0, 10), ...topicMomentum(topic.results.videos) })
    }
    momentum[topic.id] = series
  }

  const mine = channels.filter((c) => c.isMine).map((c) => c.id)
  const history: Record<string, ChannelSnapshot[]> = Object.fromEntries(await dbListChannelSnapshots(mine))
  return { momentum, history }
})
