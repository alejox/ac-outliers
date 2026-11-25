import { parsePeriod, periodDates, reportRows, sourceShares } from '~~/shared/analytics'

/**
 * "Mi canal": de dónde vienen las vistas del canal de quien entró con Google, qué buscan para
 * encontrarlo y qué videos de otros lo recomiendan. Usa YouTube Analytics (no gasta la cuota de la
 * Data API) y 2 unidades para los títulos de esos videos.
 */
export default defineEventHandler(async (event) => {
  const period = parsePeriod(getQuery(event).days)
  if (appMode() === 'demo') return demoMyChannel(period)

  const userId = readSession(event)
  const user = userId ? await dbGetUser(userId) : null
  if (!user) throw createError({ statusCode: 401, message: 'Entra con Google para ver las estadísticas de tu canal.' })
  if (!user.channelId) throw createError({ statusCode: 404, message: 'Tu cuenta de Google no tiene un canal de YouTube.' })
  const refresh = user.refreshTokenEnc ? decryptSecret(user.refreshTokenEnc) : null
  if (!refresh) throw createError({ statusCode: 401, message: 'Falta el permiso para leer tu canal. Sal y vuelve a entrar con Google.' })

  const { access_token: token } = await refreshAccessToken(refresh)
  const dates = periodDates(period)
  const detail = (type: string, max: number) =>
    analyticsReport(token, {
      ...dates,
      dimensions: 'insightTrafficSourceDetail',
      metrics: 'views',
      filters: `insightTrafficSourceType==${type}`,
      sort: '-views',
      maxResults: max,
    })

  const [totals, sources, search, related] = await Promise.all([
    analyticsReport(token, { ...dates, metrics: 'views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost' }),
    analyticsReport(token, { ...dates, dimensions: 'insightTrafficSourceType', metrics: 'views' }),
    detail('YT_SEARCH', 25),
    detail('RELATED_VIDEO', 15),
  ])

  const t = reportRows(totals)[0] ?? {}
  const relatedRows = reportRows(related).map((r) => ({ videoId: String(r.insightTrafficSourceDetail), views: Number(r.views) }))
  const videos = relatedRows.length ? await fetchVideosByIds(relatedRows.map((r) => r.videoId)) : []
  const channels = videos.length ? await fetchChannelsByIds([...new Set(videos.map((v) => v.channelId))]) : []
  const videoById = new Map(videos.map((v) => [v.id, v]))
  const channelById = new Map(channels.map((c) => [c.id, c]))

  return {
    demo: false,
    channel: { id: user.channelId, title: user.channelTitle },
    period,
    ...dates,
    totals: {
      views: Number(t.views ?? 0),
      minutes: Number(t.estimatedMinutesWatched ?? 0),
      averageViewDuration: Number(t.averageViewDuration ?? 0),
      subscribersGained: Number(t.subscribersGained ?? 0),
      subscribersLost: Number(t.subscribersLost ?? 0),
    },
    sources: sourceShares(reportRows(sources).map((r) => ({ type: String(r.insightTrafficSourceType), views: Number(r.views) }))),
    searchTerms: reportRows(search).map((r) => ({ term: String(r.insightTrafficSourceDetail), views: Number(r.views) })),
    related: relatedRows.map((r) => {
      const v = videoById.get(r.videoId)
      return {
        videoId: r.videoId,
        views: r.views,
        title: v?.title ?? null,
        thumbnailUrl: v?.thumbnailUrl ?? null,
        channelTitle: v ? (channelById.get(v.channelId)?.title ?? null) : null,
        own: v?.channelId === user.channelId,
      }
    }),
  }
})
