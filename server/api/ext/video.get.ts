import { demoTags } from '~~/shared/extension'

/**
 * Lo que la extensión muestra bajo el título del video que estás viendo: sus etiquetas,
 * si ya lo guardaste y si sigues su canal. 1 unidad por las etiquetas.
 */
export default defineEventHandler(async (event) => {
  const id = String(getQuery(event).id ?? '')
  const channelId = String(getQuery(event).channel ?? '')
  if (!/^[\w-]{11}$/.test(id)) throw createError({ statusCode: 400, message: 'Falta el ID del video.' })
  if (appMode() === 'demo') return { mode: 'demo', tags: demoTags(id), saved: false, followed: false }

  const [tags, saved, channels] = await Promise.all([fetchVideoTags(id), dbIsSaved(id), dbListChannels()])
  return {
    mode: 'live',
    tags: tags ?? [],
    saved,
    followed: channels.some((c) => c.id === channelId),
    quotaUsed: 1,
  }
})
