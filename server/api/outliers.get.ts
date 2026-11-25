import { scoreVideos } from '~~/shared/outliers'

/** Canales seguidos y todos sus videos ya puntuados. Los filtros se aplican en el navegador. */
export default defineEventHandler(async (event) => {
  if (appMode() === 'demo') {
    const { channels, videos } = demoData()
    return { demo: true, open: false, channels, videos: scoreVideos(videos), changes: demoChanges(videos) }
  }
  const userId = await currentUserId(event)
  const [channels, videos, previous, allChanges] = await Promise.all([
    dbListChannels(userId),
    dbListVideos(userId),
    dbListPreviousReadings(),
    dbListRecentChanges(),
  ])
  // Solo los cambios de los videos de tus canales.
  const ids = new Set(videos.map((v) => v.id))
  const changes = Object.fromEntries(Object.entries(allChanges).filter(([id]) => ids.has(id)))
  // open: la app tiene datos reales y ninguna contraseña que la proteja.
  return { demo: false, open: !useRuntimeConfig().appPassword, channels, videos: scoreVideos(videos, new Date(), previous), changes }
})
