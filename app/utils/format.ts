import type { ScoredVideo } from '~~/shared/outliers'

export const compact = new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 })
const relative = new Intl.RelativeTimeFormat('es', { numeric: 'always' })

export function formatScore(score: number) {
  const digits = score < 10 && !Number.isInteger(score) ? 1 : 0
  return `${score.toLocaleString('es', { minimumFractionDigits: digits, maximumFractionDigits: digits })}×`
}

export function periodLabel(days: number) {
  return days === 365 ? 'el último año' : `los últimos ${days} días`
}

export function formatAge(days: number) {
  if (days < 1) return 'hoy'
  if (days < 30) return relative.format(-Math.floor(days), 'day')
  if (days < 365) return relative.format(-Math.floor(days / 30), 'month')
  return relative.format(-Math.floor(days / 365), 'year')
}

export function formatDuration(total: number) {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

export function scoreTier(score: number | null) {
  if (score === null) return 'none'
  if (score >= 10) return 'extreme'
  if (score >= 3) return 'high'
  if (score >= 1.5) return 'above'
  return 'normal'
}

// La regla va de 0,25× a 32× en escala logarítmica; lo normal (1×) cae al 28,6 %.
const STRIP_MIN = -2
const STRIP_SPAN = 7
export const NORMAL_AT = (-STRIP_MIN / STRIP_SPAN) * 100

export function stripPosition(score: number) {
  const clamped = Math.min(Math.max(Math.log2(Math.max(score, 0.01)), STRIP_MIN), STRIP_MIN + STRIP_SPAN)
  return ((clamped - STRIP_MIN) / STRIP_SPAN) * 100
}

export function stripFill(score: number) {
  const pos = stripPosition(score)
  return { left: `${Math.min(pos, NORMAL_AT)}%`, width: `${Math.abs(pos - NORMAL_AT)}%` }
}

/** Color estable para canales sin imagen. */
export function hueOf(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return (h * 137) % 360
}

export const videoUrl = (v: ScoredVideo) =>
  v.isShort ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`

/** Vistas por hora: con un decimal cuando son pocas, compactas cuando son muchas. */
export function formatPace(perHour: number) {
  if (perHour < 10) return perHour.toLocaleString('es', { maximumFractionDigits: 1 })
  return compact.format(Math.round(perHour))
}

export function formatPercent(ratio: number, digits = 1) {
  return `${(ratio * 100).toLocaleString('es', { maximumFractionDigits: digits })} %`
}

const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' })

/** "12 ago 2026". Acepta AAAA-MM-DD (día sin hora) o una fecha ISO completa. */
export function formatDate(value: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value)
  return dateFormat.format(date).replace('.', '')
}

/** Metas redondas en palabras: "500", "10 mil", "1 millón", "10 millones". */
export function milestoneLabel(n: number) {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `${m.toLocaleString('es')} ${m === 1 ? 'millón' : 'millones'}`
  }
  if (n >= 1_000) return `${(n / 1_000).toLocaleString('es')} mil`
  return n.toLocaleString('es')
}

/** "+38 %" o "−12 %" (con el signo menos tipográfico). */
export function formatChange(ratio: number) {
  const value = Math.abs(ratio * 100).toLocaleString('es', { maximumFractionDigits: 0 })
  return `${ratio < 0 ? '−' : '+'}${value} %`
}

/** "Cambió el título hace 3 días": lo que cambió de un video, para su fila. */
export function changeLabel(changes: { kind: 'title' | 'thumbnail'; at: string }[]): string | null {
  if (changes.length === 0) return null
  const kinds = new Set(changes.map((c) => c.kind))
  const what = kinds.size === 2 ? 'Cambió título y miniatura' : kinds.has('title') ? 'Cambió el título' : 'Cambió la miniatura'
  const days = (Date.now() - new Date(changes[0]!.at).getTime()) / 86_400_000
  return `${what} ${formatAge(days)}`
}
