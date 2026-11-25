import { demoTags } from '~~/shared/extension'
import { matchWords } from '~~/shared/keywords'

/**
 * Lo que la extensión muestra bajo el título del video que estás viendo: sus etiquetas,
 * si ya lo guardaste, si sigues su canal y cuáles de sus etiquetas usan los outliers de tus canales.
 * 1 unidad por las etiquetas.
 */
export default defineEventHandler(async (event) => {
  const id = String(getQuery(event).id ?? '')
  const channelId = String(getQuery(event).channel ?? '')
  if (!/^[\w-]{11}$/.test(id)) throw createError({ statusCode: 400, message: 'Falta el ID del video.' })
  if (appMode() === 'demo') {
    const tags = demoTags(id)
    const demoWords = [
      { text: 'tutorial obs', outliers: 4, avgScore: 6.2 },
      { text: 'stream deck', outliers: 3, avgScore: 8.4 },
      { text: 'plugins obs', outliers: 3, avgScore: 4.1 },
      { text: 'obs 32', outliers: 2, avgScore: 5.5 },
    ]
    return { mode: 'demo', tags, saved: false, followed: false, ...matchWords(tags, demoWords) }
  }

  const userId = await currentUserId(event)
  const [tags, saved, channels, words] = await Promise.all([
    fetchVideoTags(id),
    dbIsSaved(userId, id),
    dbListChannels(userId),
    userTagKeywords(userId).catch(() => []),
  ])
  return {
    mode: 'live',
    tags: tags ?? [],
    ...matchWords(tags ?? [], words),
    saved,
    followed: channels.some((c) => c.id === channelId),
    quotaUsed: 1,
  }
})
