import { describe, expect, it } from 'vitest'
import {
  channelBaseline,
  demoScores,
  isBaselineFresh,
  MAX_EXT_VIDEOS,
  parseVideoRequests,
  scoreAgainst,
} from '../shared/extension'
import { daysAgo, NOW, video } from './helpers'

describe('parseVideoRequests', () => {
  it('se queda con IDs válidos, sin repetir', () => {
    const out = parseVideoRequests({
      videos: [
        { id: 'dQw4w9WgXcQ', short: false },
        { id: 'dQw4w9WgXcQ', short: true },
        { id: 'abc_DEF-123', short: true },
        { id: 'corto' },
        { id: 42 },
        null,
      ],
    })
    expect(out).toEqual([
      { id: 'dQw4w9WgXcQ', short: false },
      { id: 'abc_DEF-123', short: true },
    ])
  })

  it('tolera cuerpos vacíos o raros', () => {
    expect(parseVideoRequests(null)).toEqual([])
    expect(parseVideoRequests({ videos: 'x' })).toEqual([])
  })

  it('corta en el máximo de una consulta', () => {
    const videos = Array.from({ length: 80 }, (_, i) => ({ id: `video${String(i).padStart(6, '0')}` }))
    expect(parseVideoRequests({ videos })).toHaveLength(MAX_EXT_VIDEOS)
  })
})

describe('channelBaseline', () => {
  const long = (views: number, days = 20) => video({ views, publishedAt: daysAgo(days) })

  it('usa la mediana del formato pedido e ignora los videos muy nuevos', () => {
    const videos = [long(100), long(200), long(300), long(400), long(500), long(99_999, 1), video({ isShort: true, views: 5 })]
    expect(channelBaseline(videos, false, NOW)).toEqual({ median: 300, sample: 5 })
  })

  it('no calcula nada con muy pocos videos', () => {
    expect(channelBaseline([long(100), long(200)], false, NOW)).toEqual({ median: null, sample: 2 })
    expect(channelBaseline([long(100)], true, NOW)).toEqual({ median: null, sample: 0 })
  })
})

describe('isBaselineFresh', () => {
  it('vale por un día', () => {
    expect(isBaselineFresh(new Date(NOW.getTime() - 23 * 3_600_000).toISOString(), NOW)).toBe(true)
    expect(isBaselineFresh(new Date(NOW.getTime() - 25 * 3_600_000).toISOString(), NOW)).toBe(false)
  })
})

describe('scoreAgainst', () => {
  it('divide por lo normal y no inventa sin referencia', () => {
    expect(scoreAgainst(5000, 1000)).toBe(5)
    expect(scoreAgainst(5000, null)).toBeNull()
    expect(scoreAgainst(5000, 0)).toBeNull()
  })
})

describe('demoScores', () => {
  it('es estable y coherente', () => {
    const [a] = demoScores([{ id: 'dQw4w9WgXcQ', short: false }])
    const [b] = demoScores([{ id: 'dQw4w9WgXcQ', short: false }])
    expect(a).toEqual(b)
    expect(a!.score).toBeGreaterThan(0)
  })
})
