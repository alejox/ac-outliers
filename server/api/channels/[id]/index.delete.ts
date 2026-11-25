/** Deja de seguir un canal. Si nadie más lo sigue, se borran sus videos e historial. */
export default defineEventHandler(async (event) => {
  requireLive()
  await dbDeleteChannel(await currentUserId(event), getRouterParam(event, 'id')!)
  return { ok: true }
})
