// Palabras de los outliers: qué etiquetas y frases de título comparten los videos que rindieron
// varias veces lo normal, frente a los que no. Sin IA: solo se cuenta y se pondera por el score.

import { normalizeText, STOPWORDS } from './filters'

/** Desde este score un video cuenta como outlier. */
export const OUTLIER_AT = 2
/** Lo máximo que YouTube admite en el campo de etiquetas. */
export const TAG_CHAR_LIMIT = 500

export interface KeywordVideo {
  id: string
  title: string
  tags?: string[] | null
  score: number | null
}

export type KeywordSource = 'tags' | 'titles'

export interface Keyword {
  /** Forma más usada, en minúsculas. */
  text: string
  /** Clave sin tildes ni mayúsculas. */
  key: string
  /** Outliers que la usan. */
  outliers: number
  /** Videos con score que la usan (outliers y no outliers). */
  videos: number
  /** Score promedio de los outliers que la usan. */
  avgScore: number
  /** Qué parte de los videos que la usan son outliers (0 a 1). */
  hitRate: number
  /** Otras formas de escribirla que aparecen en los datos: plurales, sin espacio, errores de escritura. */
  variants: string[]
  /** IDs de los outliers que la usan, del más fuerte al más débil. */
  videoIds: string[]
}

export interface KeywordOptions {
  /** Mínimo de outliers distintos que deben usarla. */
  minOutliers?: number
  limit?: number
}

const clean = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
const keyOf = (s: string) => normalizeText(clean(s))
const digits = (s: string) => s.replace(/\D+/g, ' ').trim()

/** Distancia de edición con salida temprana: devuelve max + 1 si ya se pasó. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
      cur.push(v)
      if (v < best) best = v
    }
    if (best > max) return max + 1
    prev = cur
  }
  return prev[b.length]!
}

/**
 * ¿Son dos formas de escribir lo mismo? Iguales sin espacios ni guiones ("streamdeck" y "stream deck"),
 * o a 1 letra de distancia (2 si son largas). Nunca si cambian los números ("iphone 14" y "iphone 15").
 */
export function sameWord(a: string, b: string): boolean {
  if (a === b) return true
  if (digits(a) !== digits(b)) return false
  const sa = a.replace(/[\s-]+/g, '')
  const sb = b.replace(/[\s-]+/g, '')
  if (sa === sb) return true
  const n = Math.min(sa.length, sb.length)
  if (n < 5) return false
  return editDistance(sa, sb, n >= 10 ? 2 : 1) <= (n >= 10 ? 2 : 1)
}

/** Frases de 1 a 3 palabras seguidas de un título, sin empezar ni terminar en palabra vacía. */
export function titlePhrases(title: string): { key: string; text: string }[] {
  const tokens = title
    .toLowerCase()
    .split(/[^\p{L}\p{N}+#]+/u)
    .filter(Boolean)
    .map((text) => ({ text, key: normalizeText(text) }))
  const out = new Map<string, string>()
  for (let i = 0; i < tokens.length; i++) {
    for (let n = 1; n <= 3 && i + n <= tokens.length; n++) {
      const slice = tokens.slice(i, i + n)
      const first = slice[0]!.key
      const last = slice[slice.length - 1]!.key
      if (STOPWORDS.has(first) || STOPWORDS.has(last)) continue
      if (n === 1 && (first.length < 3 || /^\d+$/.test(first))) continue
      const key = slice.map((t) => t.key).join(' ')
      if (!out.has(key)) out.set(key, slice.map((t) => t.text).join(' '))
    }
  }
  return [...out].map(([key, text]) => ({ key, text }))
}

function termsOf(v: KeywordVideo, source: KeywordSource): { key: string; text: string }[] {
  if (source === 'titles') return titlePhrases(v.title)
  const seen = new Map<string, string>()
  for (const tag of v.tags ?? []) {
    const text = clean(tag)
    const key = keyOf(tag)
    if (key.length >= 2 && !seen.has(key)) seen.set(key, text)
  }
  return [...seen].map(([key, text]) => ({ key, text }))
}

/**
 * Las palabras que más comparten los outliers. Cada una pesa la suma de log2(score) de los outliers
 * que la usan, multiplicada por la parte de sus videos que son outliers: así sube "stream deck casero"
 * (4 outliers a 9×) y baja "arduino" (6 videos normales y un outlier). Las variantes de escritura se
 * agrupan en una sola, con la forma más usada al frente.
 */
export function outlierKeywords(videos: KeywordVideo[], source: KeywordSource, opts: KeywordOptions = {}): Keyword[] {
  const minOutliers = opts.minOutliers ?? 2
  const limit = opts.limit ?? 24
  const scored = videos.filter((v) => v.score !== null)

  // Por clave: qué videos la usan y cómo se escribe.
  const uses = new Map<string, { ids: Set<string>; forms: Map<string, number> }>()
  const byId = new Map(scored.map((v) => [v.id, v]))
  for (const v of scored) {
    for (const t of termsOf(v, source)) {
      const u = uses.get(t.key) ?? { ids: new Set(), forms: new Map() }
      u.ids.add(v.id)
      u.forms.set(t.text, (u.forms.get(t.text) ?? 0) + 1)
      uses.set(t.key, u)
    }
  }

  // Agrupa variantes de escritura (solo etiquetas: en títulos, "video" y "videos" ya pesan juntas poco).
  const keys = [...uses.keys()].filter((k) => [...uses.get(k)!.ids].some((id) => (byId.get(id)!.score ?? 0) >= OUTLIER_AT))
  const parent = new Map(keys.map((k) => [k, k]))
  const find = (k: string): string => (parent.get(k) === k ? k : find(parent.get(k)!))
  if (source === 'tags') {
    const sorted = [...keys].sort((a, b) => a.length - b.length)
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i]!
        const b = sorted[j]!
        if (b.replace(/[\s-]/g, '').length - a.replace(/[\s-]/g, '').length > 2) break
        if (sameWord(a, b)) parent.set(find(b), find(a))
      }
    }
  }
  const groups = new Map<string, string[]>()
  for (const k of keys) groups.set(find(k), [...(groups.get(find(k)) ?? []), k])

  const results: (Keyword & { weight: number })[] = []
  for (const members of groups.values()) {
    const ids = new Set<string>()
    const forms = new Map<string, number>()
    for (const k of members) {
      const u = uses.get(k)!
      u.ids.forEach((id) => ids.add(id))
      u.forms.forEach((n, f) => forms.set(f, (forms.get(f) ?? 0) + n))
    }
    const list = [...ids].map((id) => byId.get(id)!)
    const hits = list.filter((v) => (v.score ?? 0) >= OUTLIER_AT).sort((a, b) => b.score! - a.score!)
    // Una palabra suelta de título dice poco ("probé", "truco"): necesita un outlier más que una frase.
    const single = source === 'titles' && !members[0]!.includes(' ')
    if (hits.length < minOutliers + (single ? 1 : 0)) continue
    const ordered = [...forms].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
    const text = ordered[0]![0]
    const hitRate = hits.length / list.length
    results.push({
      text,
      key: keyOf(text),
      outliers: hits.length,
      videos: list.length,
      avgScore: hits.reduce((s, v) => s + v.score!, 0) / hits.length,
      hitRate,
      variants: ordered.slice(1).map(([f]) => f).filter((f) => keyOf(f) !== keyOf(text)).slice(0, 4),
      videoIds: hits.map((v) => v.id),
      // Con pocos videos, 2 de 2 no es tan seguro como 8 de 10: se suaviza con 2 videos de más.
      weight: hits.reduce((s, v) => s + Math.log2(v.score!), 0) * (hits.length / (list.length + 2)),
    })
  }

  results.sort((a, b) => b.weight - a.weight || b.outliers - a.outliers || a.text.localeCompare(b.text))

  // Varias frases salen de los mismos videos ("stream deck casero", "casero durante 30"):
  // de cada grupo con los mismos videos queda una, la que menos palabras vacías y números tiene.
  {
    const noise = (k: string) => k.split(' ').filter((w) => STOPWORDS.has(w) || /^\d+$/.test(w)).length
    const best = new Map<string, (typeof results)[number]>()
    for (const r of results) {
      const id = [...r.videoIds].sort().join(',') + '|' + r.videos
      const cur = best.get(id)
      if (!cur || noise(r.key) < noise(cur.key) || (noise(r.key) === noise(cur.key) && r.key.split(' ').length > cur.key.split(' ').length)) best.set(id, r)
    }
    const keep = new Set(best.values())
    for (let i = results.length - 1; i >= 0; i--) if (!keep.has(results[i]!)) results.splice(i, 1)
  }

  // En títulos, una palabra suelta sobra si una frase que la contiene la usan los mismos outliers.
  const kept: typeof results = []
  for (const r of results) {
    if (source === 'titles') {
      const shadow = kept.some(
        (k) => k.key.split(' ').length > r.key.split(' ').length && ` ${k.key} `.includes(` ${r.key} `) && k.outliers >= r.outliers,
      )
      const covers = results.find(
        (k) => k !== r && k.key.split(' ').length > r.key.split(' ').length && ` ${k.key} `.includes(` ${r.key} `) && k.outliers === r.outliers && k.videos === r.videos,
      )
      if (shadow || covers) continue
    }
    kept.push(r)
    if (kept.length >= limit) break
  }
  return kept.map(({ weight: _w, ...k }) => k)
}

/** ¿Te encuentran por esta palabra? Compara con los términos de búsqueda de tu canal, palabra por palabra. */
export function matchesTerm(keyword: string, terms: string[]): boolean {
  const k = ` ${keyOf(keyword)} `
  return terms.some((t) => {
    const term = ` ${keyOf(t)} `
    return term.includes(k) || k.includes(term)
  })
}

/** Caracteres que YouTube cuenta para una lista de etiquetas: las que llevan espacio suman las comillas. */
export const tagChars = (tags: string[]) =>
  tags.reduce((n, t) => n + t.length + (t.includes(' ') ? 2 : 0), 0) + Math.max(0, tags.length - 1)

/** Las primeras etiquetas que caben en el límite de YouTube, listas para pegar. */
export function tagsToCopy(words: string[], max = 15, limit = TAG_CHAR_LIMIT): string[] {
  const out: string[] = []
  for (const w of words) {
    if (out.length >= max) break
    if (out.some((o) => keyOf(o) === keyOf(w))) continue
    if (tagChars([...out, w]) > limit) continue
    out.push(w)
  }
  return out
}

export interface WordHit {
  text: string
  outliers: number
  avgScore: number
}

/**
 * Para la extensión: qué etiquetas del video usan también los outliers de tus canales (`hits`, por
 * etiqueta en minúsculas) y cuáles de las más fuertes no usa (`missing`, hasta 6).
 */
export function matchWords(tags: string[], words: WordHit[]): { hits: Record<string, WordHit>; missing: WordHit[] } {
  const hits: Record<string, WordHit> = {}
  const used = new Set<string>()
  for (const tag of tags) {
    const k = keyOf(tag)
    const w = words.find((x) => sameWord(keyOf(x.text), k))
    if (w) {
      hits[clean(tag)] = { text: w.text, outliers: w.outliers, avgScore: Math.round(w.avgScore * 10) / 10 }
      used.add(keyOf(w.text))
    }
  }
  const missing = words
    .filter((w) => !used.has(keyOf(w.text)))
    .slice(0, 6)
    .map((w) => ({ text: w.text, outliers: w.outliers, avgScore: Math.round(w.avgScore * 10) / 10 }))
  return { hits, missing }
}
