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
