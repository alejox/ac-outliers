// Lógica pura del outlier score. No depende de Nuxt ni de la API, así que se puede
// probar sola y reutilizar tal cual en la extensión de Chrome.

export interface Channel {
  id: string
  title: string
  handle: string | null
  thumbnailUrl: string | null
  subscriberCount: number | null
  lastSyncedAt: string | null
}

export interface Video {
  id: string
  channelId: string
  title: string
  thumbnailUrl: string | null
  publishedAt: string
  durationSeconds: number
  isShort: boolean
  views: number
  likes: number | null
  comments: number | null
}

export interface ScoredVideo extends Video {
  /** Vistas del video ÷ vistas normales del canal. null si no hay datos suficientes. */
  score: number | null
  /** Vistas normales del canal para ese formato (mediana). */
  baseline: number | null
  ageDays: number
  viewsPerDay: number
}

/** Con menos videos que esto la mediana no dice nada, así que no se calcula score. */
export const MIN_BASELINE_VIDEOS = 5
/** Los videos más nuevos que esto siguen acumulando vistas y bajarían la mediana. */
export const MIN_BASELINE_AGE_DAYS = 2

const DAY_MS = 86_400_000

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/** Convierte la duración ISO 8601 de YouTube (PT1H2M3S, P1DT2H…) a segundos. */
export function parseIsoDuration(iso: string): number {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso ?? '')
  if (!match) return 0
  const [, d, h, m, s] = match
  return Number(d ?? 0) * 86_400 + Number(h ?? 0) * 3_600 + Number(m ?? 0) * 60 + Number(s ?? 0)
}

/**
 * Calcula el score de cada video contra la mediana de su propio canal y formato.
 * Shorts y videos largos nunca se comparan entre sí: sus vistas no son equivalentes.
 */
export function scoreVideos(videos: Video[], now: Date = new Date()): ScoredVideo[] {
  const nowMs = now.getTime()
  const ageOf = (v: Video) => Math.max(0, (nowMs - new Date(v.publishedAt).getTime()) / DAY_MS)

  const groups = new Map<string, number[]>()
  for (const v of videos) {
    if (ageOf(v) < MIN_BASELINE_AGE_DAYS) continue
    const key = `${v.channelId}|${v.isShort}`
    const list = groups.get(key)
    if (list) list.push(v.views)
    else groups.set(key, [v.views])
  }

  const baselines = new Map<string, number | null>()
  for (const [key, views] of groups) {
    baselines.set(key, views.length >= MIN_BASELINE_VIDEOS ? median(views) : null)
  }

  return videos.map((v) => {
    const ageDays = ageOf(v)
    const baseline = baselines.get(`${v.channelId}|${v.isShort}`) ?? null
    return {
      ...v,
      ageDays,
      viewsPerDay: v.views / Math.max(ageDays, 1),
      baseline,
      score: baseline && baseline > 0 ? v.views / baseline : null,
    }
  })
}
