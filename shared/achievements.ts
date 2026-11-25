// Logros de un canal tuyo. Lógica pura: recibe el canal, sus videos guardados y su historial diario.

import type { Channel, ScoredVideo } from './outliers'

export const SUBSCRIBER_MILESTONES = [100, 500, 1_000, 5_000, 10_000, 50_000, 100_000, 500_000, 1_000_000]
export const CHANNEL_VIEW_MILESTONES = [1_000, 10_000, 100_000, 1_000_000, 10_000_000]
export const SCORE_MILESTONES = [2, 5, 10]
export const VIDEO_VIEW_MILESTONES = [1_000, 10_000, 100_000]

/** Una foto diaria de las cifras del canal (tabla channel_snapshots). */
export interface ChannelSnapshot {
  /** AAAA-MM-DD */
  date: string
  subscriberCount: number | null
  viewCount: number | null
}

/** Qué cifra mide un logro: decide cómo se escriben la meta y lo que falta. */
export type AchievementKind = 'subscribers' | 'views' | 'score' | 'videoViews' | 'record' | 'mostViewed' | 'streak' | 'total'

export interface Achievement {
  id: string
  kind: AchievementKind
  /** La meta (1.000 suscriptores, 5×…) o la cifra del logro (récord, racha). */
  value: number
  achieved: boolean
  /** Cuándo se logró (AAAA-MM-DD o ISO). null si no se sabe. */
  date: string | null
  /** Ya se había logrado antes de la primera foto guardada: no hay fecha. */
  before: boolean
  /** El video que lo logró, si es un logro de videos. */
  video: { id: string; title: string; isShort: boolean } | null
  /** Solo en la siguiente meta sin lograr de cada escalera. */
  progress: { current: number; target: number; remaining: number; ratio: number } | null
}

export interface AchievementGroup {
  key: 'subscribers' | 'views' | 'videos' | 'consistency'
  items: Achievement[]
}

const blank = (id: string, kind: AchievementKind, value: number): Achievement => ({
  id,
  kind,
  value,
  achieved: false,
  date: null,
  before: false,
  video: null,
  progress: null,
})

const progressTo = (current: number, target: number) => ({
  current,
  target,
  remaining: Math.max(0, target - current),
  ratio: Math.min(1, Math.max(0, current / target)),
})

/**
 * Escalera de una cifra del canal (suscriptores o vistas totales). Cada meta lleva la fecha de la
 * primera foto en la que la cifra la alcanzó; si ya estaba alcanzada en la primera foto, no hay fecha.
 */
function counterLadder(
  kind: 'subscribers' | 'views',
  milestones: number[],
  current: number | null,
  history: ChannelSnapshot[],
): Achievement[] {
  const field = kind === 'subscribers' ? 'subscriberCount' : 'viewCount'
  const points = history
    .filter((s) => s[field] !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
  const latest = current ?? points[points.length - 1]?.[field] ?? null
  let nextSet = false

  return milestones.map((m) => {
    const item = blank(`${kind}-${m}`, kind, m)
    const firstIndex = points.findIndex((s) => s[field]! >= m)
    if (firstIndex >= 0 || (latest !== null && latest >= m)) {
      item.achieved = true
      if (firstIndex > 0) item.date = points[firstIndex]!.date
      else item.before = true
    } else if (!nextSet && latest !== null) {
      nextSet = true
      item.progress = progressTo(latest, m)
    }
    return item
  })
}

const byDate = (a: ScoredVideo, b: ScoredVideo) => a.publishedAt.localeCompare(b.publishedAt)
const ref = (v: ScoredVideo) => ({ id: v.id, title: v.title, isShort: v.isShort })

/** Escalera de videos: la meta la logra el primer video publicado que la cumpla. */
function videoLadder(
  kind: 'score' | 'videoViews',
  milestones: number[],
  videos: ScoredVideo[],
  value: (v: ScoredVideo) => number | null,
): Achievement[] {
  const sorted = [...videos].sort(byDate)
  const best = Math.max(0, ...videos.map((v) => value(v) ?? 0))
  let nextSet = false
  return milestones.map((m) => {
    const item = blank(`${kind}-${m}`, kind, m)
    const first = sorted.find((v) => (value(v) ?? 0) >= m)
    if (first) {
      item.achieved = true
      item.date = first.publishedAt
      item.video = ref(first)
    } else if (!nextSet && videos.length > 0) {
      nextSet = true
      item.progress = progressTo(best, m)
    }
    return item
  })
}

const WEEK_MS = 7 * 86_400_000
/** Lunes 00:00 UTC de la semana de una fecha, como número de semana. */
const weekOf = (ms: number) => Math.floor((ms + 3 * 86_400_000) / WEEK_MS)

/**
 * Semanas seguidas (de lunes a domingo, UTC) con al menos una subida, contando hacia atrás desde
 * esta semana. Si esta semana todavía no hay subida, la racha sigue viva y se cuenta desde la anterior.
 */
export function uploadStreak(videos: { publishedAt: string }[], now: Date = new Date()): number {
  const weeks = new Set(videos.map((v) => weekOf(new Date(v.publishedAt).getTime())))
  let week = weekOf(now.getTime())
  if (!weeks.has(week)) week -= 1
  let streak = 0
  while (weeks.has(week)) {
    streak += 1
    week -= 1
  }
  return streak
}

/**
 * Logros de un canal tuyo en cuatro grupos: suscriptores, vistas del canal, videos y constancia.
 * Los de videos salen de los videos guardados (los últimos 50 largos y 50 Shorts), no de toda la
 * historia del canal.
 */
export function channelAchievements(
  channel: Channel,
  videos: ScoredVideo[],
  history: ChannelSnapshot[],
  now: Date = new Date(),
): AchievementGroup[] {
  const own = videos.filter((v) => v.channelId === channel.id)
  const long = own.filter((v) => !v.isShort)

  const scoreLadder = videoLadder('score', SCORE_MILESTONES, long, (v) => v.score)
  const viewLadder = videoLadder('videoViews', VIDEO_VIEW_MILESTONES, own, (v) => v.views)

  const best = long.reduce<ScoredVideo | null>((top, v) => (v.score !== null && (!top || v.score > top.score!) ? v : top), null)
  const record = blank('record', 'record', best?.score ?? 0)
  if (best) Object.assign(record, { achieved: true, date: best.publishedAt, video: ref(best) })

  const most = own.reduce<ScoredVideo | null>((top, v) => (!top || v.views > top.views ? v : top), null)
  const mostViewed = blank('most-viewed', 'mostViewed', most?.views ?? 0)
  if (most) Object.assign(mostViewed, { achieved: true, date: most.publishedAt, video: ref(most) })

  const streakWeeks = uploadStreak(own, now)
  const streak = blank('streak', 'streak', streakWeeks)
  streak.achieved = streakWeeks > 0

  const totalCount = channel.videoCount ?? own.length
  const total = blank('total', 'total', totalCount)
  total.achieved = totalCount > 0

  return [
    { key: 'subscribers', items: counterLadder('subscribers', SUBSCRIBER_MILESTONES, channel.subscriberCount, history) },
    { key: 'views', items: counterLadder('views', CHANNEL_VIEW_MILESTONES, channel.viewCount, history) },
    { key: 'videos', items: [...scoreLadder, record, ...viewLadder, mostViewed] },
    { key: 'consistency', items: [streak, total] },
  ]
}
