import { brandSvg } from '~~/shared/brand'

/**
 * Página que conecta la extensión con la cuenta de Google de quien entró. Con sesión, deja en la página
 * un token propio para la extensión; el script de la extensión que corre en esta página lo recoge.
 * Sin sesión, ofrece entrar con Google y volver aquí.
 */
const page = (body: string, meta = '') => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png">${meta}
<title>Conectar la extensión · AC Outliers</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap">
<style>
:root{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0e0e0f;color:#f4f3f1;font:400 14px/1.5 Geist,system-ui,sans-serif}
main{width:min(380px,calc(100% - 32px));padding:32px 24px;border:1px solid #1f2022;border-radius:16px;background:#18181a;text-align:center}
.mark{display:block;margin:0 auto 16px}h1{margin:0 0 8px;font-size:18px;font-weight:600}p{margin:0;color:#aeadaa}
a.button{display:inline-flex;align-items:center;justify-content:center;height:40px;margin-top:24px;padding:0 18px;border-radius:999px;background:#f4f3f1;color:#0e0e0f;font-weight:500;text-decoration:none}
.state{margin-top:20px;padding:10px 12px;border:1px solid rgba(255,255,255,.12);border-radius:999px;color:#f4f3f1}.state[data-ok="no"]{border-color:#5a2a2b;color:#ff6363}
</style></head><body><main>
${brandSvg(36).replace('<svg ', '<svg class="mark" aria-hidden="true" ')}
${body}</main></body></html>`

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export default defineEventHandler(async (event) => {
  setResponseHeaders(event, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' })
  const userId = googleConfigured() && appMode() === 'live' ? readSession(event) : null
  const user = userId ? await dbGetUser(userId) : null

  if (!user) {
    return page(`<h1>Conecta la extensión con tu cuenta</h1>
<p>Entra con Google para que la extensión use tus canales, tus guardados y tus temas.</p>
${googleConfigured() ? '<a class="button" href="/api/auth/google?next=/conectar-extension">Entrar con Google</a>' : '<p class="state" data-ok="no">El login con Google no está configurado en esta app.</p>'}`)
  }

  const token = signExtToken(user.id)
  return page(
    `<h1>Conectando la extensión</h1>
<p>Cuenta: ${escape(user.email)}</p>
<p class="state" id="acx-state" role="status">Esperando a la extensión. Si no la tienes instalada, instálala y vuelve a abrir esta página desde su panel.</p>`,
    `<meta name="acx-token" content="${escape(token)}"><meta name="acx-account" content="${escape(user.email)}">`,
  )
})
