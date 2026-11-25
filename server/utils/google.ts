import { createError, type H3Event } from 'h3'

/** Permisos que pide el login: identidad, lectura del canal y sus estadísticas. */
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
]

/** La dirección a la que Google devuelve el login: debe estar registrada en el cliente OAuth. */
export function callbackUrl(event: H3Event): string {
  const url = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true })
  return `${url.origin}/api/auth/callback`
}

export function authorizeUrl(event: H3Event, state: string): string {
  const { googleClientId } = useRuntimeConfig()
  const params = new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: callbackUrl(event),
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    include_granted_scopes: 'true',
    // Pedir el consentimiento siempre asegura que Google entregue el refresh token.
    prompt: 'consent select_account',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const { googleClientId, googleClientSecret } = useRuntimeConfig()
  try {
    return await $fetch<TokenResponse>('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({ client_id: googleClientId, client_secret: googleClientSecret, ...body }),
    })
  } catch (err: any) {
    const reason = err?.data?.error
    throw createError({
      statusCode: reason === 'invalid_grant' ? 401 : 502,
      message:
        reason === 'invalid_grant'
          ? 'Google retiró el permiso de la app. Vuelve a entrar con Google.'
          : `Google no respondió al login: ${err?.data?.error_description ?? reason ?? 'error desconocido'}.`,
    })
  }
}

export const exchangeCode = (event: H3Event, code: string) =>
  tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: callbackUrl(event) })

export const refreshAccessToken = (refreshToken: string) =>
  tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' })

export async function googleProfile(accessToken: string) {
  return await $fetch<{ sub: string; email: string; name?: string; picture?: string }>(
    'https://openidconnect.googleapis.com/v1/userinfo',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
}

/** El canal de YouTube de la cuenta que entró, o null si no tiene. Cuenta 1 unidad de cuota del proyecto. */
export async function myYouTubeChannel(accessToken: string): Promise<{ id: string; title: string } | null> {
  const res = await $fetch<{ items?: any[] }>('https://www.googleapis.com/youtube/v3/channels', {
    query: { part: 'snippet', mine: 'true' },
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const item = res.items?.[0]
  return item ? { id: item.id, title: item.snippet?.title ?? item.id } : null
}

/** Un reporte de YouTube Analytics del canal propio. No gasta la cuota de la YouTube Data API. */
export async function analyticsReport(accessToken: string, query: Record<string, string | number>) {
  try {
    return await $fetch<{ columnHeaders?: { name: string }[]; rows?: unknown[][] }>(
      'https://youtubeanalytics.googleapis.com/v2/reports',
      { query: { ids: 'channel==MINE', ...query }, headers: { Authorization: `Bearer ${accessToken}` } },
    )
  } catch (err: any) {
    const message = err?.data?.error?.message ?? err?.message ?? 'error desconocido'
    throw createError({
      statusCode: err?.status === 403 ? 403 : 502,
      message:
        err?.status === 403
          ? 'Google no dio permiso para leer las estadísticas del canal. Sal y vuelve a entrar con Google aceptando todos los permisos.'
          : `YouTube Analytics respondió con un error: ${message}`,
    })
  }
}
