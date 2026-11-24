// Filtros y orden del ranking. Lógica pura para poder probarla y reutilizarla.

import type { ScoredVideo } from './outliers'

export type Format = 'long' | 'short' | 'all'
export type Sort = 'score' | 'pace' | 'views' | 'engagement' | 'recent'

export interface FilterState {
  format: Format
  /** 0 = cualquier fecha */
  periodDays: number
  /** 0 = sin mínimo */
  minScore: number
  sort: Sort
  title: string
  channelSize: string
  minViews: number
  duration: string
  /** '' = todas */
  category: string
}

export const defaultFilters = (over: Partial<FilterState> = {}): FilterState => ({
  format: 'long',
  periodDays: 90,
  minScore: 2,
  sort: 'score',
  title: '',
  channelSize: 'any',
  minViews: 0,
  duration: 'any',
  category: '',
  ...over,
})

interface Range {
  value: string
  label: string
  min?: number
  max?: number
}

/** Rangos de suscriptores, para compararte con canales de tu tamaño. */
export const SIZE_OPTIONS: Range[] = [
  { value: 'any', label: 'Cualquier tamaño' },
  { value: 'xs', label: 'Menos de 10 mil', max: 10_000 },
  { value: 's', label: '10 mil a 100 mil', min: 10_000, max: 100_000 },
  { value: 'm', label: '100 mil a 1 millón', min: 100_000, max: 1_000_000 },
  { value: 'l', label: 'Más de 1 millón', min: 1_000_000 },
]

/** Rangos de duración en segundos. */
export const DURATION_OPTIONS: Range[] = [
  { value: 'any', label: 'Cualquier duración' },
  { value: 'brief', label: 'Menos de 5 min', max: 300 },
  { value: 'mid', label: '5 a 20 min', min: 300, max: 1_200 },
  { value: 'long', label: 'Más de 20 min', min: 1_200 },
]

export const VIEWS_OPTIONS = [
  { value: 0, label: 'Sin mínimo' },
  { value: 1_000, label: '1 mil' },
  { value: 10_000, label: '10 mil' },
  { value: 100_000, label: '100 mil' },
  { value: 1_000_000, label: '1 millón' },
]

const inRange = (n: number, range?: Range) =>
  !range || ((range.min === undefined || n >= range.min) && (range.max === undefined || n < range.max))

/** Minúsculas y sin tildes, para que "codigo" encuentre "Código". */
export const normalizeText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Cuántos de los filtros avanzados están activos. */
export const extraFilterCount = (f: FilterState) =>
  Number(f.channelSize !== 'any') + Number(f.minViews > 0) + Number(f.duration !== 'any') + Number(f.category !== '')

export function applyFilters(
  videos: ScoredVideo[],
  f: FilterState,
  /** Suscriptores por canal. Un canal que los oculta (null) solo pasa con "Cualquier tamaño". */
  subscribers: Map<string, number | null>,
  onlyChannel: string | null = null,
): ScoredVideo[] {
  const words = normalizeText(f.title).split(/\s+/).filter(Boolean)
  const size = f.channelSize === 'any' ? undefined : SIZE_OPTIONS.find((o) => o.value === f.channelSize)
  const duration = f.duration === 'any' ? undefined : DURATION_OPTIONS.find((o) => o.value === f.duration)

  const list = videos.filter((v) => {
    if (f.format !== 'all' && v.isShort !== (f.format === 'short')) return false
    if (f.periodDays > 0 && v.ageDays > f.periodDays) return false
    if (onlyChannel && v.channelId !== onlyChannel) return false
    if (f.minScore > 0 && (v.score === null || v.score < f.minScore)) return false
    if (v.views < f.minViews) return false
    if (f.category && v.categoryId !== f.category) return false
    if (duration && !inRange(v.durationSeconds, duration)) return false
    if (size) {
      const subs = subscribers.get(v.channelId)
      if (subs === null || subs === undefined || !inRange(subs, size)) return false
    }
    if (words.length > 0) {
      const title = normalizeText(v.title)
      if (!words.every((word) => title.includes(word))) return false
    }
    return true
  })

  const key: Record<Sort, (v: ScoredVideo) => number> = {
    score: (v) => v.score ?? -1,
    pace: (v) => v.viewsPerHour,
    views: (v) => v.views,
    engagement: (v) => v.engagement ?? -1,
    recent: (v) => -v.ageDays,
  }
  return list.sort((a, b) => key[f.sort](b) - key[f.sort](a))
}

// Palabras vacías en español e inglés, ya sin tildes.
const STOPWORDS = new Set(
  `a al algo ante asi aun bien cada casi como con contra cual cuando de del desde donde dos el ella ellos en entre era es esa
ese eso esta estan estas este esto estos fue ha hace hacer hasta hay la las le les lo los mas me mejor mi mis mucho muy nada ni
no nos nuevo nueva o para pero por porque que quien se sea ser si sin sobre solo son su sus tambien te tiene todo todos tu tus
un una uno unos vs y ya yo
about after all an and are as at be best but by can do for from get has have how i if in into is it its just more most my new
no not of on one or our out so than that the their them these they this to up was we what when which who why will with you your`
    .split(/\s+/)
    .filter(Boolean),
)

/**
 * Palabras que más se repiten en un grupo de títulos. Cuenta cada palabra una vez por título
 * y solo devuelve las que aparecen en al menos `minVideos`.
 */
export function topWords(titles: string[], limit = 8, minVideos = 3): { word: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const title of titles) {
    const words = new Set(
      normalizeText(title)
        .split(/[^a-z0-9ñ+#.]+/)
        .map((w) => w.replace(/^[.#+]+|[.]+$/g, ''))
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w)),
    )
    for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1)
  }
  return [...counts]
    .filter(([, count]) => count >= minVideos)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }))
}
