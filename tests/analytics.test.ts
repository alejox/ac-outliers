import { describe, expect, it } from 'vitest'
import {
  compareTotals,
  dailySeries,
  netSubscribers,
  parsePeriod,
  peakDay,
  periodDates,
  previousPeriodDates,
  readTotals,
  relativeChange,
  reportRows,
  sourceShares,
  trafficSourceName,
} from '../shared/analytics'

describe('reportRows', () => {
  it('convierte filas en objetos por columna', () => {
    const rows = reportRows({ columnHeaders: [{ name: 'insightTrafficSourceType' }, { name: 'views' }], rows: [['YT_SEARCH', 120]] })
    expect(rows).toEqual([{ insightTrafficSourceType: 'YT_SEARCH', views: 120 }])
  })
  it('tolera un reporte vacío', () => {
    expect(reportRows(null)).toEqual([])
    expect(reportRows({ columnHeaders: [{ name: 'views' }] })).toEqual([])
  })
})

describe('sourceShares', () => {
  it('ordena, calcula la parte y junta las pequeñas', () => {
    const out = sourceShares([
      { type: 'YT_SEARCH', views: 300 },
      { type: 'RELATED_VIDEO', views: 690 },
      { type: 'EXT_URL', views: 6 },
      { type: 'NOTIFICATION', views: 4 },
    ])
    expect(out.map((s) => [s.name, s.views])).toEqual([
      ['Videos sugeridos', 690],
      ['Búsqueda de YouTube', 300],
      ['Otras fuentes', 10],
    ])
    expect(out[0]!.share).toBeCloseTo(0.69)
  })
  it('sin vistas no hay fuentes', () => {
    expect(sourceShares([{ type: 'YT_SEARCH', views: 0 }])).toEqual([])
  })
})

describe('periodDates', () => {
  it('termina ayer y cuenta los días pedidos', () => {
    expect(periodDates(7, new Date('2026-11-25T15:00:00Z'))).toEqual({ startDate: '2026-11-18', endDate: '2026-11-24' })
  })
})

describe('parsePeriod y nombres', () => {
  it('acepta solo los periodos conocidos', () => {
    expect(parsePeriod('7')).toBe(7)
    expect(parsePeriod('365')).toBe(28)
  })
  it('nombra fuentes desconocidas como otras', () => {
    expect(trafficSourceName('YT_SEARCH')).toBe('Búsqueda de YouTube')
    expect(trafficSourceName('NUEVA')).toBe('Otras fuentes')
  })
})

describe('previousPeriodDates', () => {
  it('es el periodo del mismo largo que termina el día antes del actual', () => {
    const now = new Date('2026-11-25T15:00:00Z')
    expect(periodDates(28, now)).toEqual({ startDate: '2026-10-28', endDate: '2026-11-24' })
    expect(previousPeriodDates(28, now)).toEqual({ startDate: '2026-09-30', endDate: '2026-10-27' })
    expect(previousPeriodDates(7, now)).toEqual({ startDate: '2026-11-11', endDate: '2026-11-17' })
  })
})

describe('compareTotals', () => {
  const t = (views: number, minutes: number, avg: number, gained: number, lost: number) => ({
    views,
    minutes,
    averageViewDuration: avg,
    subscribersGained: gained,
    subscribersLost: lost,
  })
  it('da el cambio relativo de cada cifra, con suscriptores netos', () => {
    const out = compareTotals(t(122, 600, 97, 300, 50), t(100, 500, 100, 150, 50))
    expect(out.views).toBeCloseTo(0.22)
    expect(out.hours).toBeCloseTo(0.2)
    expect(out.averageViewDuration).toBeCloseTo(-0.03)
    expect(out.subscribers).toBeCloseTo(1.5)
  })
  it('sin periodo anterior no inventa un cambio', () => {
    expect(compareTotals(t(10, 1, 1, 1, 0), t(0, 0, 0, 0, 0))).toEqual({ views: null, hours: null, averageViewDuration: null, subscribers: null })
  })
  it('si antes se perdían suscriptores, ganar es un cambio positivo', () => {
    expect(relativeChange(20, -10)).toBeCloseTo(3)
  })
})

describe('readTotals', () => {
  it('lee la fila de Analytics y tolera que falte', () => {
    expect(readTotals({ views: '12', estimatedMinutesWatched: 30, averageViewDuration: 200, subscribersGained: 5, subscribersLost: 1 })).toEqual({
      views: 12,
      minutes: 30,
      averageViewDuration: 200,
      subscribersGained: 5,
      subscribersLost: 1,
    })
    expect(netSubscribers(readTotals(undefined))).toBe(0)
  })
})

describe('dailySeries y peakDay', () => {
  it('rellena con cero los días sin datos y encuentra el pico', () => {
    const series = dailySeries(
      [
        { day: '2026-11-02', views: 40 },
        { day: '2026-11-04', views: 90 },
      ],
      '2026-11-01',
      '2026-11-05',
    )
    expect(series.map((d) => d.views)).toEqual([0, 40, 0, 90, 0])
    expect(series[0]!.date).toBe('2026-11-01')
    expect(peakDay(series)).toEqual({ date: '2026-11-04', views: 90 })
  })
  it('sin vistas no hay pico', () => {
    expect(peakDay(dailySeries([], '2026-11-01', '2026-11-03'))).toBeNull()
  })
})
