/** Quita un video de guardados. */
export default defineEventHandler(async (event) => {
  requireLive()
  await dbUnsaveVideo(await currentUserId(event), getRouterParam(event, 'id')!)
  return { ok: true }
})
