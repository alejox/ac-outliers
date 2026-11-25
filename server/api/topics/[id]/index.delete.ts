/** Deja de seguir un tema. Si nadie más lo sigue, se borran sus resultados guardados. */
export default defineEventHandler(async (event) => {
  requireLive()
  await dbDeleteTopic(await currentUserId(event), getRouterParam(event, 'id')!)
  return { ok: true }
})
