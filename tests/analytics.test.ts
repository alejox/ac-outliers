import { describe, expect, it } from 'vitest'
import { parsePeriod, periodDates, reportRows, sourceShares, trafficSourceName } from '../shared/analytics'

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
