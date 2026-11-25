// "Mi canal": lógica pura sobre las respuestas de YouTube Analytics. Sin Nuxt ni red.

/** Nombres en español de las fuentes de tráfico de YouTube Analytics (insightTrafficSourceType). */
export const TRAFFIC_SOURCES: Record<string, string> = {
  YT_SEARCH: 'Búsqueda de YouTube',
  RELATED_VIDEO: 'Videos sugeridos',
  SUBSCRIBER: 'Inicio y suscripciones',
  SHORTS: 'Feed de Shorts',
  EXT_URL: 'Sitios externos',
  NO_LINK_OTHER: 'Directo o desconocido',
  NO_LINK_EMBEDDED: 'Reproductor insertado',
  PLAYLIST: 'Listas de reproducción',
  YT_PLAYLIST_PAGE: 'Páginas de listas',
  YT_CHANNEL: 'Páginas de canal',
  YT_OTHER_PAGE: 'Otras páginas de YouTube',
  NOTIFICATION: 'Notificaciones',
  END_SCREEN: 'Pantallas finales',
  ANNOTATION: 'Tarjetas y anotaciones',
  CAMPAIGN_CARD: 'Tarjetas de campaña',
  ADVERTISING: 'Anuncios de YouTube',
  HASHTAGS: 'Hashtags',
  SOUND_PAGE: 'Páginas de sonido',
  LIVE_REDIRECT: 'Redirección de directos',
  PRODUCT_PAGE: 'Páginas de producto',
  VIDEO_REMIXES: 'Remixes',
  IMMERSIVE_LIVE: 'Directos inmersivos',
}

export const trafficSourceName = (type: string) => TRAFFIC_SOURCES[type] ?? 'Otras fuentes'

/** Las filas de un reporte de Analytics como objetos, con los nombres de columna como claves. */
export function reportRows(report: { columnHeaders?: { name: string }[]; rows?: unknown[][] } | null): Record<string, any>[] {
  const headers = report?.columnHeaders?.map((h) => h.name) ?? []
  return (report?.rows ?? []).map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i]])))
}

export interface SourceShare {
  type: string
  name: string
  views: number
  /** Parte del total, de 0 a 1. */
  share: number
}

/**
 * Las fuentes de tráfico de mayor a menor, con su parte del total. Las que quedan por debajo del
 * 2 % se juntan en "Otras fuentes" para que la lista se lea de un vistazo.
 */
export function sourceShares(rows: { type: string; views: number }[], minShare = 0.02): SourceShare[] {
  const total = rows.reduce((sum, r) => sum + r.views, 0)
  if (total === 0) return []
  const sorted = [...rows].sort((a, b) => b.views - a.views)
  const main = sorted.filter((r) => r.views / total >= minShare)
  const rest = sorted.filter((r) => r.views / total < minShare).reduce((sum, r) => sum + r.views, 0)
  const out = main.map((r) => ({ type: r.type, name: trafficSourceName(r.type), views: r.views, share: r.views / total }))
  if (rest > 0) out.push({ type: 'OTHER', name: 'Otras fuentes', views: rest, share: rest / total })
  return out
}

/** Fechas AAAA-MM-DD de un periodo que termina ayer: Analytics no tiene el día de hoy completo. */
export function periodDates(days: number, now: Date = new Date()): { startDate: string; endDate: string } {
  const end = new Date(now.getTime() - 86_400_000)
  const start = new Date(end.getTime() - (days - 1) * 86_400_000)
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }
}

export const ANALYTICS_PERIODS = [7, 28, 90] as const
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number]
export const parsePeriod = (value: unknown): AnalyticsPeriod =>
  ANALYTICS_PERIODS.find((p) => String(p) === String(value)) ?? 28

const DAY = 86_400_000
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const dayMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`)

/** El periodo del mismo largo que termina justo antes de `periodDates(days)`: con él se compara. */
export function previousPeriodDates(days: number, now: Date = new Date()): { startDate: string; endDate: string } {
  const current = periodDates(days, now)
  const end = dayMs(current.startDate) - DAY
  return { startDate: isoDay(end - (days - 1) * DAY), endDate: isoDay(end) }
}

export interface ChannelTotals {
  views: number
  minutes: number
  averageViewDuration: number
  subscribersGained: number
  subscribersLost: number
}

/** Los totales de un reporte sin dimensiones (una sola fila). Sin fila, todo en cero. */
export function readTotals(row: Record<string, any> | undefined): ChannelTotals {
  return {
    views: Number(row?.views ?? 0),
    minutes: Number(row?.estimatedMinutesWatched ?? 0),
    averageViewDuration: Number(row?.averageViewDuration ?? 0),
    subscribersGained: Number(row?.subscribersGained ?? 0),
    subscribersLost: Number(row?.subscribersLost ?? 0),
  }
}

export const netSubscribers = (t: ChannelTotals) => t.subscribersGained - t.subscribersLost

/** Cambio relativo frente al periodo anterior (0,22 = +22 %). null si antes no había con qué comparar. */
export function relativeChange(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null
  return (current - previous) / Math.abs(previous)
}

export interface TotalsChange {
  views: number | null
  hours: number | null
  averageViewDuration: number | null
  subscribers: number | null
}

/** Cuánto cambió cada cifra de Mi canal frente al periodo anterior del mismo largo. */
export function compareTotals(current: ChannelTotals, previous: ChannelTotals): TotalsChange {
  return {
    views: relativeChange(current.views, previous.views),
    hours: relativeChange(current.minutes, previous.minutes),
    averageViewDuration: relativeChange(current.averageViewDuration, previous.averageViewDuration),
    subscribers: relativeChange(netSubscribers(current), netSubscribers(previous)),
  }
}

export interface DailyViews {
  /** AAAA-MM-DD */
  date: string
  views: number
}

/** Vistas por día de todo el periodo, en orden. Los días que Analytics no devuelve valen cero. */
export function dailySeries(rows: { day: string; views: number }[], startDate: string, endDate: string): DailyViews[] {
  const byDay = new Map(rows.map((r) => [String(r.day), Number(r.views) || 0]))
  const out: DailyViews[] = []
  for (let t = dayMs(startDate); t <= dayMs(endDate); t += DAY) {
    const date = isoDay(t)
    out.push({ date, views: byDay.get(date) ?? 0 })
  }
  return out
}

/** El día con más vistas del periodo (el primero si hay empate). null si no hubo vistas. */
export function peakDay(series: DailyViews[]): DailyViews | null {
  let best: DailyViews | null = null
  for (const d of series) if (d.views > 0 && (!best || d.views > best.views)) best = d
  return best
}
