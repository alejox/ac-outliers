import { scoreVideos } from '~~/shared/outliers'

/** Canales seguidos y todos sus videos ya puntuados. Los filtros se aplican en el navegador. */
export default defineEventHandler(async () => {
  if (appMode() === 'demo') {
    const { channels, videos } = demoData()
    return { demo: true, open: false, channels, videos: scoreVideos(videos) }
  }
  const [channels, videos, previous] = await Promise.all([dbListChannels(), dbListVideos(), dbListPreviousReadings()])
  // open: la app tiene datos reales y ninguna contraseña que la proteja.
  return { demo: false, open: !useRuntimeConfig().appPassword, channels, videos: scoreVideos(videos, new Date(), previous) }
})
