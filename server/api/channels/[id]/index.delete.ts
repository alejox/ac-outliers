/** Quita un canal junto con sus videos e historial. */
export default defineEventHandler(async (event) => {
  requireLive()
  await dbDeleteChannel(getRouterParam(event, 'id')!)
  return { ok: true }
})
