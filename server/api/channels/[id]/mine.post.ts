/** Marca o desmarca un canal que sigues como tuyo. No gasta cuota. */
export default defineEventHandler(async (event) => {
  requireLive()
  const body = await readBody<{ mine?: unknown }>(event)
  if (typeof body?.mine !== 'boolean') {
    throw createError({ statusCode: 400, message: 'Falta indicar si el canal es tuyo.' })
  }
  await dbSetChannelMine(await currentUserId(event), getRouterParam(event, 'id')!, body.mine)
  return { ok: true, isMine: body.mine }
})
