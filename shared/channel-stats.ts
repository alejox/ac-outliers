// Resumen por canal para compararlos entre sí.

import type { Channel, ScoredVideo } from './outliers'

export interface ChannelStats {
  channel: Channel
  /** Vistas normales de un video largo. */
  baseline: number | null
  /** Vistas normales ÷ suscriptores: qué parte de su audiencia ve un video típico. */
  reach: number | null
  /** Videos y Shorts publicados en los últimos 30 días. */
  uploads30: number
  /** Videos largos con score publicados en los últimos 90 días. */
  recent90: number
  /** De esos, cuántos llegaron al menos a 2×. */
  outliers90: number
  hitRate: number | null
  /** El video largo con mejor score de los últimos 90 días. */
  best: ScoredVideo | null
}

export const OUTLIER_AT = 2

export function channelStats(channels: Channel[], videos: ScoredVideo[]): ChannelStats[] {
  const byChannel = new Map<string, ScoredVideo[]>()
  for (const v of videos) {
    const list = byChannel.get(v.channelId)
    if (list) list.push(v)
    else byChannel.set(v.channelId, [v])
  }

  return channels.map((channel) => {
    const own = byChannel.get(channel.id) ?? []
    const long = own.filter((v) => !v.isShort)
    const baseline = long.find((v) => v.baseline !== null)?.baseline ?? null
    const recent = long.filter((v) => v.ageDays <= 90 && v.score !== null)
    const outliers90 = recent.filter((v) => v.score! >= OUTLIER_AT).length
    const best = recent.reduce<ScoredVideo | null>((top, v) => (!top || v.score! > top.score! ? v : top), null)
    return {
      channel,
      baseline,
      reach: baseline !== null && channel.subscriberCount ? baseline / channel.subscriberCount : null,
      uploads30: own.filter((v) => v.ageDays <= 30).length,
      recent90: recent.length,
      outliers90,
      hitRate: recent.length > 0 ? outliers90 / recent.length : null,
      best,
    }
  })
}
