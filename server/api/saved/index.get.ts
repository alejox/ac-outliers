import { refreshAges } from '~~/shared/outliers'

/** Los videos guardados, del más reciente al más antiguo, y las colecciones. No gasta cuota. */
export default defineEventHandler(async (event) => {
  if (appMode() === 'demo') return { videos: [], channels: [], collections: [] }
  const userId = await currentUserId(event)
  const [saved, collections] = await Promise.all([dbListSaved(userId), dbListCollections(userId)])
  const channels = new Map(saved.flatMap((s) => (s.channel ? [[s.channel.id, s.channel] as const] : [])))
  return {
    videos: refreshAges(saved.map((s) => s.video)).map((v, i) => ({
      ...v,
      savedAt: saved[i]!.savedAt,
      collectionId: saved[i]!.collectionId,
    })),
    channels: [...channels.values()],
    collections,
  }
})
