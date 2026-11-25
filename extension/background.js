// Habla con la app AC Outliers. La página de YouTube nunca ve la dirección de la app ni el token:
// el script de la página le pide puntajes a este service worker y él hace las peticiones.

const DEFAULTS = { appUrl: 'https://ac-outliers.vercel.app', token: '', connected: false, mode: '', enabled: true, minScore: 0 }
/** Los puntajes de un video se reutilizan durante 6 horas: sus vistas casi no cambian el score en ese plazo. */
const CACHE_HOURS = 6
const CACHE_LIMIT = 3000
const BATCH = 50

async function settings() {
  return { ...DEFAULTS, ...(await chrome.storage.local.get(Object.keys(DEFAULTS))) }
}

function apiUrl(base, path) {
  return `${base.replace(/\/+$/, '')}${path}`
}

async function call(path, { method = 'GET', body, token, base } = {}) {
  const s = await settings()
  const headers = { 'Content-Type': 'application/json' }
  const bearer = token ?? s.token
  if (bearer) headers.Authorization = `Bearer ${bearer}`
  let res
  try {
    res = await fetch(apiUrl(base ?? s.appUrl, path), { method, headers, body: body ? JSON.stringify(body) : undefined })
  } catch {
    throw new Error('No se pudo llegar a la app. Revisa la dirección.')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && path !== '/api/ext/connect') {
      await chrome.storage.local.set({ connected: false, token: '' })
      throw new Error('La sesión de la extensión venció. Vuelve a conectarla.')
    }
    throw new Error(data?.message || `La app respondió con un error (${res.status}).`)
  }
  if (data === null) throw new Error('Esa dirección no es la de AC Outliers.')
  return data
}

// Caché de puntajes por video

async function readCache(ids) {
  const keys = ids.map((id) => `s:${id}`)
  const stored = await chrome.storage.local.get(keys)
  const now = Date.now()
  const out = {}
  for (const id of ids) {
    const entry = stored[`s:${id}`]
    // Los guardados antes de la versión 0.3 no traen fecha de publicación: se vuelven a pedir.
    if (entry && now - entry.at < CACHE_HOURS * 3_600_000 && entry.score?.publishedAt) out[id] = entry.score
  }
  return out
}

async function writeCache(scores) {
  const at = Date.now()
  const entries = {}
  for (const s of scores) entries[`s:${s.id}`] = { at, score: s }
  await chrome.storage.local.set(entries)

  const all = await chrome.storage.local.get(null)
  const cached = Object.entries(all).filter(([k]) => k.startsWith('s:'))
  if (cached.length > CACHE_LIMIT) {
    cached.sort((a, b) => a[1].at - b[1].at)
    await chrome.storage.local.remove(cached.slice(0, cached.length - CACHE_LIMIT).map(([k]) => k))
  }
}

async function addQuota(units) {
  if (!units) return
  const today = new Date().toISOString().slice(0, 10)
  const { quota } = await chrome.storage.local.get('quota')
  const used = quota?.date === today ? quota.used : 0
  await chrome.storage.local.set({ quota: { date: today, used: used + units } })
}

async function scores(videos) {
  const s = await settings()
  if (!s.connected) return { scores: {}, error: 'not-connected' }

  const found = await readCache(videos.map((v) => v.id))
  const missing = videos.filter((v) => !(v.id in found))
  for (let i = 0; i < missing.length; i += BATCH) {
    const data = await call('/api/ext/scores', { method: 'POST', body: { videos: missing.slice(i, i + BATCH) } })
    await writeCache(data.scores)
    await addQuota(data.quotaUsed)
    for (const score of data.scores) found[score.id] = score
    // Los que YouTube no devolvió (privados, en vivo, sin vistas públicas) quedan sin puntaje.
    for (const v of missing.slice(i, i + BATCH)) if (!(v.id in found)) found[v.id] = null
  }
  return { scores: found }
}

// Video que estás viendo: etiquetas, guardado y canal seguido. Se reutiliza 6 horas.
async function videoInfo({ id, channelId }) {
  const s = await settings()
  if (!s.connected) throw new Error('not-connected')
  const key = `v:${id}`
  const stored = (await chrome.storage.local.get(key))[key]
  if (stored && Date.now() - stored.at < CACHE_HOURS * 3_600_000) return stored.info
  const data = await call(`/api/ext/video?id=${encodeURIComponent(id)}&channel=${encodeURIComponent(channelId ?? '')}`)
  await addQuota(data.quotaUsed)
  const info = { tags: data.tags, saved: data.saved, followed: data.followed }
  await chrome.storage.local.set({ [key]: { at: Date.now(), info } })
  return info
}

async function patchInfo(id, change) {
  const key = `v:${id}`
  const stored = (await chrome.storage.local.get(key))[key]
  if (stored) await chrome.storage.local.set({ [key]: { ...stored, info: { ...stored.info, ...change } } })
}

async function save({ id, short, saved }) {
  const data = await call('/api/ext/save', { method: 'POST', body: { id, short, saved } })
  await patchInfo(id, { saved: data.saved })
  return { saved: data.saved }
}

async function follow({ id, channelId }) {
  await call('/api/ext/follow', { method: 'POST', body: { channelId } })
  await addQuota(5)
  await patchInfo(id, { followed: true })
  return { followed: true }
}

async function connect({ appUrl, password }) {
  let base
  try {
    const url = new URL(appUrl.trim())
    if (!/^https?:$/.test(url.protocol)) throw new Error()
    base = url.origin
  } catch {
    throw new Error('Escribe la dirección completa de la app, por ejemplo https://ac-outliers.vercel.app.')
  }
  const data = await call('/api/ext/connect', { method: 'POST', body: { password }, token: '', base })
  // Cambiar de app o de modo invalida los puntajes guardados.
  const all = await chrome.storage.local.get(null)
  await chrome.storage.local.remove(Object.keys(all).filter((k) => k.startsWith('s:') || k.startsWith('v:')))
  await chrome.storage.local.set({ appUrl: base, token: data.token, connected: true, mode: data.mode })
  return { mode: data.mode }
}

async function disconnect() {
  const all = await chrome.storage.local.get(null)
  await chrome.storage.local.remove(Object.keys(all).filter((k) => k.startsWith('s:') || k.startsWith('v:')))
  await chrome.storage.local.set({ token: '', connected: false, mode: '' })
}

chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  const run = {
    scores: () => scores(message.videos ?? []),
    connect: () => connect(message),
    disconnect: () => disconnect(),
    status: () => call('/api/ext/status'),
    video: () => videoInfo(message),
    save: () => save(message),
    follow: () => follow(message),
  }[message?.type]
  if (!run) return false
  run()
    .then((result) => reply({ ok: true, ...result }))
    .catch((err) => reply({ ok: false, error: err.message }))
  return true
})
