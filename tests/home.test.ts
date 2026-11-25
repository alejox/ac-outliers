import { describe, expect, it } from 'vitest'
import { largestMine, momentumTrend, recentHits, suggestCompetitors, topicMomentum } from '../shared/home'
import { channel, daysAgo, scored, video } from './helpers'

const base = () => Array.from({ length: 6 }, (_, i) => video({ views: 1000, publishedAt: daysAgo(20 + i) }))

describe('recentHits', () => {
  it('trae solo lo publicado en 14 días con 2× o más, del más nuevo al más antiguo', () => {
    const list = scored([
      ...base(),
      video({ id: 'nuevo', views: 3000, publishedAt: daysAgo(3) }),
      video({ id: 'menos-nuevo', views: 5000, publishedAt: daysAgo(10) }),
      video({ id: 'viejo', views: 9000, publishedAt: daysAgo(15) }),
      video({ id: 'flojo', views: 1500, publishedAt: daysAgo(2) }),
    ])
    expect(recentHits(list).map((v) => v.id)).toEqual(['nuevo', 'menos-nuevo'])
  })

  it('se queda con un máximo', () => {
    const list = scored([...base(), ...base(), ...base(), ...Array.from({ length: 9 }, (_, i) => video({ views: 4000, publishedAt: daysAgo(3 + i) }))])
    expect(recentHits(list, 6)).toHaveLength(6)
  })
})

describe('topicMomentum', () => {
  it('suma las vistas por hora de los videos largos de 2× o más', () => {
    const [a, b, c, d] = scored([video({ views: 100 }), video({ views: 200 }), video({ views: 300 }), video({ views: 400 })])
    const list = [
      { ...a!, score: 2, viewsPerHour: 100 },
      { ...b!, score: 5, viewsPerHour: 50 },
      { ...c!, score: 1.9, viewsPerHour: 1000 },
      { ...d!, score: 8, viewsPerHour: 999, isShort: true },
    ]
    expect(topicMomentum(list)).toEqual({ momentum: 150, outliers: 2, videos: 4 })
  })
})

describe('momentumTrend', () => {
  const p = (date: string, momentum: number) => ({ date, momentum, outliers: 1, videos: 1 })

  it('compara con el punto de hace 7 días', () => {
    const t = momentumTrend([p('2026-11-10', 50), p('2026-11-17', 100), p('2026-11-20', 120), p('2026-11-24', 138)])!
    expect(t.base!.date).toBe('2026-11-17')
    expect(t.daysBack).toBe(7)
    expect(t.change).toBeCloseTo(0.38)
  })

  it('sin un punto de hace 7 días usa el más antiguo', () => {
    const t = momentumTrend([p('2026-11-22', 200), p('2026-11-24', 176)])!
    expect(t.daysBack).toBe(2)
    expect(t.change).toBeCloseTo(-0.12)
  })

  it('con un solo punto no hay cambio', () => {
    expect(momentumTrend([p('2026-11-24', 10)])).toMatchObject({ base: null, change: null })
    expect(momentumTrend([])).toBeNull()
  })
})

describe('suggestCompetitors', () => {
  const vids = scored([
    ...Array.from({ length: 6 }, () => video({ channelId: 'x', views: 100 })),
    ...Array.from({ length: 6 }, () => video({ channelId: 'y', views: 100 })),
    ...Array.from({ length: 6 }, () => video({ channelId: 'z', views: 100 })),
    video({ channelId: 'x', views: 300 }),
    video({ channelId: 'y', views: 300 }),
    video({ channelId: 'y', views: 900 }),
    video({ channelId: 'z', views: 2000 }),
    video({ channelId: 'z', views: 9000, isShort: true }),
  ])
  const chans = [
    { ...channel({ id: 'x', subscriberCount: 5_000 }), followed: false },
    { ...channel({ id: 'y', subscriberCount: 900_000 }), followed: false },
    { ...channel({ id: 'z', subscriberCount: 20_000 }), followed: false },
    { ...channel({ id: 'f', subscriberCount: 20_000 }), followed: true },
  ]

  it('ordena por outliers y luego por mejor score, sin canales seguidos', () => {
    expect(suggestCompetitors(vids, chans, null).map((s) => s.channel.id)).toEqual(['y', 'z', 'x'])
  })

  it('con un canal tuyo, primero los de tamaño parecido', () => {
    const list = suggestCompetitors(vids, chans, 10_000)
    expect(list.map((s) => s.channel.id)).toEqual(['z', 'x', 'y'])
    expect(list.map((s) => s.similarSize)).toEqual([true, true, false])
  })

  it('el canal tuyo más grande manda', () => {
    expect(largestMine([channel({ isMine: true, subscriberCount: 10 }), channel({ isMine: true, subscriberCount: 99 }), channel({ subscriberCount: 5000 })])).toBe(99)
    expect(largestMine([channel()])).toBeNull()
  })
})
