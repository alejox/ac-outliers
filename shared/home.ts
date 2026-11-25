// Lógica pura de Inicio: éxitos recientes, impulso de los temas y competidores sugeridos.

import type { Channel, ScoredVideo } from './outliers'

/** Desde este score un video cuenta como outlier en Inicio. */
export const HIT_SCORE = 2
/** Éxitos recientes: publicados en estos días. */
export const RECENT_DAYS = 14

/** Los videos de tus canales publicados hace poco que ya llegaron a 2×, del más nuevo al más antiguo. */
export function recentHits(videos: ScoredVideo[], limit = 6, days = RECENT_DAYS): ScoredVideo[] {
  return videos
    .filter((v) => v.ageDays <= days && v.score !== null && v.score >= HIT_SCORE)
    .sort((a, b) => a.ageDays - b.ageDays)
    .slice(0, limit)
}

// Impulso de un tema

export interface MomentumPoint {
  /** Día de la foto, AAAA-MM-DD. */
  date: string
  momentum: number
  outliers: number
  videos: number
}

/**
 * Impulso de un tema en una actualización: la suma de las vistas por hora de sus videos largos
 * con score de 2× o más entre los resultados guardados. Las vistas por hora son las del momento
 * de la búsqueda (vistas ÷ horas desde la publicación), así que el impulso mide cuánta atención
 * están atrayendo ahora mismo los outliers del tema. `outliers` cuenta esos videos y `videos`
 * todos los resultados.
 */
export function topicMomentum(videos: ScoredVideo[]): Omit<MomentumPoint, 'date'> {
  const hits = videos.filter((v) => !v.isShort && v.score !== null && v.score >= HIT_SCORE)
  return {
    momentum: hits.reduce((sum, v) => sum + v.viewsPerHour, 0),
    outliers: hits.length,
    videos: videos.length,
  }
}

export interface MomentumTrend {
  latest: MomentumPoint
  /** El punto con el que se compara: el de hace 7 días o, si no hay, el más antiguo. null con un solo punto. */
  base: MomentumPoint | null
  /** Días entre base y latest. */
  daysBack: number
  /** Cambio relativo: 0,38 = +38 %. null si no hay base o la base vale 0. */
  change: number | null
}

const dayNumber = (date: string) => Math.round(new Date(`${date}T00:00:00Z`).getTime() / 86_400_000)

/** Compara el último punto con el de 7 días antes (o el más cercano anterior). */
export function momentumTrend(series: MomentumPoint[], days = 7): MomentumTrend | null {
  if (series.length === 0) return null
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted[sorted.length - 1]!
  if (sorted.length < 2) return { latest, base: null, daysBack: 0, change: null }
  const target = dayNumber(latest.date) - days
  // El más reciente que tenga al menos `days` de antigüedad; si ninguno, el más antiguo.
  const base = [...sorted].reverse().find((p) => dayNumber(p.date) <= target) ?? sorted[0]!
  return {
    latest,
    base,
    daysBack: dayNumber(latest.date) - dayNumber(base.date),
    change: base.momentum > 0 ? (latest.momentum - base.momentum) / base.momentum : null,
  }
}

// Competidores sugeridos

export interface Suggestion {
  channel: Channel
  /** Videos largos de 2× o más del canal entre los resultados de tus temas. */
  outliers: number
  best: number
  /** Entre 0,2× y 5× los suscriptores de tu canal más grande. */
  similarSize: boolean
}

/** Rango de tamaño que se considera "parecido al tuyo". */
export const SIZE_RANGE = [0.2, 5] as const

/**
 * Canales que aparecen en los resultados de tus temas y que no sigues, ordenados por cuántos
 * outliers tienen ahí y luego por su mejor score. Si marcaste un canal como tuyo (`mineSubs`),
 * van primero los de un tamaño parecido al tuyo.
 */
export function suggestCompetitors(
  videos: ScoredVideo[],
  channels: (Channel & { followed: boolean })[],
  mineSubs: number | null,
  limit = 8,
): Suggestion[] {
  const tally = new Map<string, { outliers: number; best: number }>()
  for (const v of videos) {
    if (v.isShort || v.score === null || v.score < HIT_SCORE) continue
    const t = tally.get(v.channelId) ?? { outliers: 0, best: 0 }
    t.outliers += 1
    t.best = Math.max(t.best, v.score)
    tally.set(v.channelId, t)
  }

  const similar = (c: Channel) =>
    mineSubs !== null &&
    mineSubs > 0 &&
    c.subscriberCount !== null &&
    c.subscriberCount >= mineSubs * SIZE_RANGE[0] &&
    c.subscriberCount <= mineSubs * SIZE_RANGE[1]

  return channels
    .filter((c) => !c.followed && !c.isMine && tally.has(c.id))
    .map((channel) => ({ channel, ...tally.get(channel.id)!, similarSize: similar(channel) }))
    .sort(
      (a, b) =>
        Number(b.similarSize) - Number(a.similarSize) || b.outliers - a.outliers || b.best - a.best,
    )
    .slice(0, limit)
}

/** Suscriptores del canal más grande que marcaste como tuyo, o null si no hay ninguno con cifra pública. */
export function largestMine(channels: Channel[]): number | null {
  const subs = channels.filter((c) => c.isMine && c.subscriberCount !== null).map((c) => c.subscriberCount!)
  return subs.length > 0 ? Math.max(...subs) : null
}
