import { refreshAges } from '~~/shared/outliers'

/** Los videos guardados, del más reciente al más antiguo. No gasta cuota. */
export default defineEventHandler(async () => {
  if (appMode() === 'demo') return { videos: [], channels: [] }
  const saved = await dbListSaved()
  const channels = new Map(saved.flatMap((s) => (s.channel ? [[s.channel.id, s.channel] as const] : [])))
  return {
    videos: refreshAges(saved.map((s) => s.video)).map((v, i) => ({ ...v, savedAt: saved[i]!.savedAt })),
    channels: [...channels.values()],
  }
})
