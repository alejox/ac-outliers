/**
 * Vuelta del login con Google: cambia el código por los permisos, guarda al usuario con su canal
 * y abre la sesión. Si la cuenta tiene canal, se sigue y se marca como tuyo.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const fail = (reason: string) => sendRedirect(event, `/?login=${encodeURIComponent(reason)}`)

  if (query.error) return fail(query.error === 'access_denied' ? 'cancelado' : 'error')
  const expected = getCookie(event, 'ac_oauth_state')
  deleteCookie(event, 'ac_oauth_state', { path: '/' })
  if (!expected || query.state !== expected || typeof query.code !== 'string') return fail('vencido')
  requireLive()

  const tokens = await exchangeCode(event, query.code)
  const [profile, channel] = await Promise.all([googleProfile(tokens.access_token), myYouTubeChannel(tokens.access_token).catch(() => null)])
  // La primera vez que el dueño entra con Google, se queda con los datos que ya había.
  if (profile.email.toLowerCase() === ownerEmail()) await dbClaimOwner(profile.sub)
  const user = await dbUpsertUser({
    googleSub: profile.sub,
    email: profile.email,
    name: profile.name ?? null,
    picture: profile.picture ?? null,
    channelId: channel?.id ?? null,
    channelTitle: channel?.title ?? null,
    refreshTokenEnc: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null,
    scopes: tokens.scope ?? null,
  })

  if (channel) {
    try {
      const known = (await dbListCatalogChannels()).some((c) => c.id === channel.id)
      if (!known) await syncChannel(channel.id)
      await dbFollowChannel(user.id, channel.id, true)
    } catch {
      // Seguir el canal es un extra: el login sigue aunque falle (por ejemplo, sin cuota).
    }
  }

  setUserCookie(event, user.id)
  const next = getCookie(event, 'ac_oauth_next')
  deleteCookie(event, 'ac_oauth_next', { path: '/' })
  if (next && /^\/(?!\/)/.test(next)) return sendRedirect(event, next)
  return sendRedirect(event, channel ? '/?seccion=mi-canal' : '/')
})
