// Lógica pura del outlier score. No depende de Nuxt ni de la API, así que se puede
// probar sola y reutilizar tal cual en la extensión de Chrome.

export interface Channel {
  id: string
  title: string
  handle: string | null
  thumbnailUrl: string | null
  subscriberCount: number | null
  viewCount: number | null
  videoCount: number | null
  lastSyncedAt: string | null
  /** Lo marcaste como tuyo: Inicio muestra sus logros y busca competidores de su tamaño. */
  isMine: boolean
}

export interface Video {
  id: string
  channelId: string
  title: string
  thumbnailUrl: string | null
  publishedAt: string
  durationSeconds: number
  isShort: boolean
  /** Categoría de YouTube (ver shared/categories.ts). null en videos guardados antes de que existiera. */
  categoryId: string | null
  views: number
  likes: number | null
  comments: number | null
  /** Etiquetas que puso el creador. Solo las traen las rutas que las necesitan. */
  tags?: string[] | null
  /** Cuándo se leyeron estas cifras de YouTube. Si falta, se asume ahora. */
  fetchedAt?: string
}

/** Una lectura anterior de las vistas de un video, para medir su ritmo reciente. */
export interface PreviousReading {
  views: number
  at: string
}

export interface ScoredVideo extends Video {
  /** Vistas del video ÷ vistas normales del canal. null si no hay datos suficientes. */
  score: number | null
  /** Vistas normales del canal para ese formato (mediana). */
  baseline: number | null
  ageDays: number
  /** Vistas por hora. Recientes si hay una lectura anterior; si no, el promedio desde que se publicó. */
  viewsPerHour: number
  /** true si viewsPerHour mide el ritmo reciente y no el promedio de toda la vida del video. */
  recentPace: boolean
  /** (likes + comentarios) ÷ vistas. null si el canal oculta los likes. */
  engagement: number | null
}

/** Con menos videos que esto la mediana no dice nada, así que no se calcula score. */
export const MIN_BASELINE_VIDEOS = 5
/** Los videos más nuevos que esto siguen acumulando vistas y bajarían la mediana. */
export const MIN_BASELINE_AGE_DAYS = 2
/** Entre dos lecturas más cercanas que esto el ritmo sale demasiado ruidoso. */
export const MIN_PACE_HOURS = 6

const HOUR_MS = 3_600_000
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
 *
 * `previous` trae la lectura anterior de cada video (por id). Con ella las vistas por hora
 * miden lo que el video está haciendo ahora, no su promedio histórico.
 */
export function scoreVideos(
  videos: Video[],
  now: Date = new Date(),
  previous?: Map<string, PreviousReading>,
): ScoredVideo[] {
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

    let viewsPerHour = v.views / Math.max(ageDays * 24, 1)
    let recentPace = false
    const before = previous?.get(v.id)
    if (before) {
      const hours = ((v.fetchedAt ? new Date(v.fetchedAt).getTime() : nowMs) - new Date(before.at).getTime()) / HOUR_MS
      if (hours >= MIN_PACE_HOURS && v.views >= before.views) {
        viewsPerHour = (v.views - before.views) / hours
        recentPace = true
      }
    }

    return {
      ...v,
      ageDays,
      baseline,
      score: baseline && baseline > 0 ? v.views / baseline : null,
      viewsPerHour,
      recentPace,
      engagement: v.likes === null || v.views === 0 ? null : (v.likes + (v.comments ?? 0)) / v.views,
    }
  })
}

/** Un tema que sigues en todo YouTube. */
export interface Topic {
  id: string
  query: string
  categoryId: string
  language: string
  days: number
  fetchedAt: string | null
}

/**
 * Pone al día la antigüedad de videos puntuados hace un rato (resultados guardados).
 * El score no cambia; las vistas por hora vuelven a ser el promedio desde la publicación.
 */
export function refreshAges(videos: ScoredVideo[], now: Date = new Date()): ScoredVideo[] {
  return videos.map((v) => {
    const ageDays = Math.max(0, (now.getTime() - new Date(v.publishedAt).getTime()) / DAY_MS)
    return { ...v, ageDays, viewsPerHour: v.views / Math.max(ageDays * 24, 1), recentPace: false }
  })
}
