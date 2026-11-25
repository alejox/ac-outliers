/** Quita un video de guardados. */
export default defineEventHandler(async (event) => {
  requireLive()
  await dbUnsaveVideo(getRouterParam(event, 'id')!)
  return { ok: true }
})
