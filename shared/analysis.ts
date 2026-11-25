// Por qué un video se sale de lo normal en su canal. Solo datos, sin IA: compara el video con los
// demás videos guardados del mismo canal y del mismo formato.

import { titleWords } from './filters'
import { median, type ScoredVideo } from './outliers'

/** Con menos videos comparables que esto las medianas no dicen nada. */
export const MIN_COMPARABLE = 5
/** Diferencias menores que esto (±15 %) se leen como "parecido". */
const SIMILAR = 0.15
const OUTLIER_AT = 2

export type FindingKey = 'score' | 'pace' | 'duration' | 'timing' | 'title' | 'words' | 'engagement'

export interface Finding {
  key: FindingKey
  /** Nombre corto del aspecto: "Vistas", "Duración"… */
  label: string
  /** Una frase con la conclusión. */
  text: string
  /** Las cifras en las que se apoya. */
  figures: { label: string; value: string }[]
}

export interface Analysis {
  /** Videos del mismo canal y formato con los que se comparó. */
  comparable: number
  /** false si hay menos de MIN_COMPARABLE: entonces no hay hallazgos. */
  enough: boolean
  findings: Finding[]
}

const num = (n: number, digits = 0) => n.toLocaleString('es', { maximumFractionDigits: digits })
const compactFormat = new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 })
/** Como en las fichas: con un decimal si es poco, entero y compacto si es mucho. */
const compact = (n: number) => (n < 10 ? num(n, 1) : compactFormat.format(Math.round(n)))
const times = (r: number) => `${num(r, r < 10 ? 1 : 0)}×`
const minutes = (s: number) => (s < 60 ? `${Math.round(s)} s` : `${num(s / 60, s < 600 ? 1 : 0)} min`)
const pct = (r: number) => `${num(r * 100, 1)} %`

/** "más", "menos" o "parecido" según cuánto se aparta `value` de `typical`. */
function compare(value: number, typical: number): 'more' | 'less' | 'same' {
  if (typical <= 0) return value > 0 ? 'more' : 'same'
  const ratio = value / typical
  if (ratio > 1 + SIMILAR) return 'more'
  if (ratio < 1 - SIMILAR) return 'less'
  return 'same'
}

function scoreMeaning(score: number): string {
  if (score >= 10) return 'Es un éxito excepcional para este canal'
  if (score >= 3) return 'Rindió muy por encima de lo normal'
  if (score >= 1.5) return 'Rindió por encima de lo normal'
  if (score >= 0.67) return 'Está dentro de lo normal del canal'
  return 'Rindió por debajo de lo normal'
}

function mode<T>(values: T[]): { value: T; count: number } | null {
  const counts = new Map<T, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let top: { value: T; count: number } | null = null
  for (const [value, count] of counts) if (!top || count > top.count) top = { value, count }
  return top
}

/**
 * Compara un video con los demás videos guardados de su canal en el mismo formato (largos con
 * largos, Shorts con Shorts). Devuelve solo los hallazgos para los que hay datos suficientes.
 * `timeZone` decide el día y la hora de publicación (por defecto, la del navegador).
 */
export function analyzeVideo(video: ScoredVideo, channelVideos: ScoredVideo[], timeZone?: string): Analysis {
  const others = channelVideos.filter(
    (v) => v.channelId === video.channelId && v.isShort === video.isShort && v.id !== video.id,
  )
  if (others.length < MIN_COMPARABLE) return { comparable: others.length, enough: false, findings: [] }

  const findings: Finding[] = []
  const format = video.isShort ? 'Shorts' : 'videos largos'

  // 1. Vistas frente a lo normal
  if (video.score !== null && video.baseline !== null) {
    const s = video.score
    const words =
      s >= 1.5 ? `Tuvo ${times(s)} las vistas normales del canal.` : s >= 0.67 ? 'Tuvo unas vistas parecidas a las normales del canal.' : `Tuvo ${times(s)} de las vistas normales del canal.`
    findings.push({
      key: 'score',
      label: 'Vistas',
      text: `${scoreMeaning(s)}. ${words}`,
      figures: [
        { label: 'Vistas', value: compact(video.views) },
        { label: 'Lo normal', value: compact(video.baseline) },
        { label: 'Score', value: times(s) },
      ],
    })
  }

  // 2. Ritmo de vistas por hora. El promedio desde la publicación favorece a los videos nuevos,
  // así que solo se compara con videos del canal de una antigüedad parecida (entre la mitad y el doble).
  const age = Math.max(video.ageDays, 1)
  const sameAge = others.filter((v) => v.ageDays >= age / 2 && v.ageDays <= age * 2)
  const pace = sameAge.length >= MIN_COMPARABLE ? median(sameAge.map((v) => v.viewsPerHour)) : null
  if (pace === null) {
    findings.push({
      key: 'pace',
      label: 'Ritmo',
      text: `Suma ${num(video.viewsPerHour, video.viewsPerHour < 10 ? 1 : 0)} vistas por hora en promedio. Hay pocos videos del canal de una antigüedad parecida para comparar su ritmo.`,
      figures: [
        { label: 'Este video', value: `${compact(video.viewsPerHour)} por hora` },
        { label: 'De edad parecida', value: `${sameAge.length} videos` },
      ],
    })
  } else if (pace > 0) {
    const ratio = video.viewsPerHour / pace
    const how = compare(video.viewsPerHour, pace)
    const now = video.recentPace ? 'Ahora suma' : 'Suma en promedio'
    findings.push({
      key: 'pace',
      label: 'Ritmo',
      text:
        how === 'same'
          ? `${now} ${num(video.viewsPerHour, video.viewsPerHour < 10 ? 1 : 0)} vistas por hora, al ritmo de los videos del canal de una antigüedad parecida.`
          : `${now} ${num(video.viewsPerHour, video.viewsPerHour < 10 ? 1 : 0)} vistas por hora, ${times(ratio)} el ritmo de los videos del canal de una antigüedad parecida.`,
      figures: [
        { label: 'Este video', value: `${compact(video.viewsPerHour)} por hora` },
        { label: `Mediana de ${sameAge.length} videos de edad parecida`, value: `${compact(pace)} por hora` },
      ],
    })
  }

  // 3. Duración
  const durations = others.map((v) => v.durationSeconds).filter((d) => d > 0)
  const duration = durations.length >= MIN_COMPARABLE ? median(durations) : null
  if (duration !== null && video.durationSeconds > 0) {
    const how = compare(video.durationSeconds, duration)
    findings.push({
      key: 'duration',
      label: 'Duración',
      text:
        how === 'same'
          ? `Dura ${minutes(video.durationSeconds)}, parecido a lo habitual en el canal.`
          : `Dura ${minutes(video.durationSeconds)}, ${how === 'more' ? 'más' : 'menos'} que lo habitual en el canal (${minutes(duration)}).`,
      figures: [
        { label: 'Este video', value: minutes(video.durationSeconds) },
        { label: 'Mediana del canal', value: minutes(duration) },
      ],
    })
  }

  // 4. Día y hora de publicación
  const dayOf = new Intl.DateTimeFormat('es', { weekday: 'long', timeZone })
  const hourOf = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone })
  const published = new Date(video.publishedAt)
  const day = dayOf.format(published)
  const common = mode(others.map((v) => dayOf.format(new Date(v.publishedAt))))
  if (common) {
    const plural = common.value.endsWith('s') ? common.value : `${common.value}s`
    findings.push({
      key: 'timing',
      label: 'Día y hora',
      text:
        common.value === day
          ? `Se publicó un ${day} a las ${hourOf.format(published)}, el día en que más publica el canal.`
          : `Se publicó un ${day} a las ${hourOf.format(published)}; el canal publica más los ${plural}.`,
      figures: [
        { label: 'Este video', value: `${day}, ${hourOf.format(published)}` },
        { label: 'Día más común', value: `${common.value} (${common.count} de ${others.length})` },
      ],
    })
  }

  // 5. Largo del título
  const titleLength = median(others.map((v) => [...v.title].length))
  if (titleLength !== null) {
    const length = [...video.title].length
    const how = compare(length, titleLength)
    findings.push({
      key: 'title',
      label: 'Título',
      text:
        how === 'same'
          ? `Su título tiene ${length} caracteres, un largo parecido al habitual.`
          : `Su título tiene ${length} caracteres, ${how === 'more' ? 'más largo' : 'más corto'} que lo habitual (${num(titleLength)}).`,
      figures: [
        { label: 'Este título', value: `${length} caracteres` },
        { label: 'Mediana del canal', value: `${num(titleLength)} caracteres` },
      ],
    })
  }

  // 6. Palabras en común con los otros outliers del canal
  const outliers = others.filter((v) => v.score !== null && v.score >= OUTLIER_AT)
  const own = titleWords(video.title)
  if (outliers.length === 0) {
    findings.push({
      key: 'words',
      label: 'Palabras',
      text: `Ningún otro de los ${format} guardados del canal llegó a 2×: no hay títulos de outliers con qué comparar.`,
      figures: [{ label: 'Otros outliers', value: '0' }],
    })
  } else {
    const shared = own
      .map(({ key, word }) => ({
        word,
        count: outliers.filter((v) => titleWords(v.title).some((w) => w.key === key)).length,
      }))
      .filter((w) => w.count > 0)
      .sort((a, b) => b.count - a.count)
    const inAny = outliers.filter((v) => titleWords(v.title).some((w) => own.some((o) => o.key === w.key))).length
    findings.push({
      key: 'words',
      label: 'Palabras',
      text:
        shared.length > 0
          ? `Comparte ${shared.map((w) => `“${w.word}”`).join(', ')} con ${
              outliers.length === 1 ? 'el otro outlier del canal' : `${inAny} de los otros ${outliers.length} outliers del canal`
            }.`
          : `Su título no comparte palabras con los otros ${outliers.length} outliers del canal.`,
      figures: shared.length > 0 ? shared.slice(0, 4).map((w) => ({ label: w.word, value: `${w.count} de ${outliers.length}` })) : [{ label: 'Otros outliers', value: String(outliers.length) }],
    })
  }

  // 7. Interacción, si los likes son públicos
  const engagements = others.map((v) => v.engagement).filter((e): e is number => e !== null)
  const engagement = engagements.length >= MIN_COMPARABLE ? median(engagements) : null
  if (video.engagement !== null && engagement !== null && engagement > 0) {
    const how = compare(video.engagement, engagement)
    findings.push({
      key: 'engagement',
      label: 'Interacción',
      text:
        how === 'same'
          ? `Su interacción (${pct(video.engagement)}) es parecida a la habitual del canal.`
          : `Su interacción (${pct(video.engagement)}) es ${how === 'more' ? 'mayor' : 'menor'} que la habitual del canal (${pct(engagement)}).`,
      figures: [
        { label: 'Este video', value: pct(video.engagement) },
        { label: 'Mediana del canal', value: pct(engagement) },
      ],
    })
  }

  return { comparable: others.length, enough: true, findings }
}
