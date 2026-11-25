import { describe, expect, it } from 'vitest'
import { channelAchievements, uploadStreak } from '../shared/achievements'
import { channel, daysAgo, NOW, scored, video } from './helpers'

const find = (groups: ReturnType<typeof channelAchievements>, id: string) =>
  groups.flatMap((g) => g.items).find((a) => a.id === id)!

describe('channelAchievements', () => {
  const history = [
    { date: '2026-06-01', subscriberCount: 700, viewCount: 40_000 },
    { date: '2026-08-01', subscriberCount: 1_200, viewCount: 90_000 },
    { date: '2026-10-01', subscriberCount: 4_000, viewCount: 120_000 },
  ]
  const videos = scored([
    ...Array.from({ length: 6 }, (_, i) => video({ views: 1000, publishedAt: daysAgo(60 + i * 7) })),
    video({ id: 'tres', views: 3000, publishedAt: daysAgo(40), title: 'Tres' }),
    video({ id: 'seis', views: 6000, publishedAt: daysAgo(20), title: 'Seis' }),
    video({ id: 'short', views: 20_000, publishedAt: daysAgo(5), isShort: true }),
  ])
  const groups = channelAchievements(channel({ subscriberCount: 4_100, viewCount: 130_000 }), videos, history, NOW)

  it('fecha los hitos de suscriptores con la primera foto que los cruzó', () => {
    expect(find(groups, 'subscribers-500')).toMatchObject({ achieved: true, before: true, date: null })
    expect(find(groups, 'subscribers-1000')).toMatchObject({ achieved: true, date: '2026-08-01' })
    expect(find(groups, 'subscribers-5000')).toMatchObject({ achieved: false, progress: { remaining: 900, target: 5000 } })
    // Solo la siguiente meta lleva progreso
    expect(find(groups, 'subscribers-10000').progress).toBeNull()
  })

  it('hace lo mismo con las vistas del canal', () => {
    expect(find(groups, 'views-100000')).toMatchObject({ achieved: true, date: '2026-10-01' })
    expect(find(groups, 'views-1000000').progress).toMatchObject({ remaining: 870_000 })
  })

  it('los logros de videos usan la fecha y el enlace del primer video que los cumplió', () => {
    expect(find(groups, 'score-2')).toMatchObject({ achieved: true, video: { id: 'tres' } })
    expect(find(groups, 'score-5')).toMatchObject({ achieved: true, video: { id: 'seis' } })
    expect(find(groups, 'score-10')).toMatchObject({ achieved: false, progress: { target: 10 } })
    expect(find(groups, 'record')).toMatchObject({ achieved: true, video: { id: 'seis' }, value: 6 })
    expect(find(groups, 'most-viewed')).toMatchObject({ video: { id: 'short' }, value: 20_000 })
    expect(find(groups, 'videoViews-10000')).toMatchObject({ achieved: true, video: { id: 'short' } })
    expect(find(groups, 'videoViews-100000').progress).toMatchObject({ remaining: 80_000 })
  })

  it('sin historial, lo ya alcanzado no tiene fecha', () => {
    const g = channelAchievements(channel({ subscriberCount: 600 }), [], [], NOW)
    expect(find(g, 'subscribers-500')).toMatchObject({ achieved: true, before: true, date: null })
    expect(find(g, 'record').achieved).toBe(false)
  })
})

describe('uploadStreak', () => {
  it('cuenta semanas seguidas con subidas, aunque esta semana aún no haya', () => {
    // NOW es martes 24 de noviembre de 2026
    const at = (d: string) => ({ publishedAt: `${d}T10:00:00Z` })
    expect(uploadStreak([at('2026-11-23'), at('2026-11-18'), at('2026-11-10'), at('2026-10-20')], NOW)).toBe(3)
    expect(uploadStreak([at('2026-11-18'), at('2026-11-12')], NOW)).toBe(2)
    expect(uploadStreak([at('2026-11-04')], NOW)).toBe(0)
  })
})
