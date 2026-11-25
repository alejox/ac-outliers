// Pone el score de cada video encima de su miniatura y, en la página de un video, junto al título.
// YouTube es una sola página que recicla sus elementos al navegar, así que todo se revisa
// cada vez que cambia el contenido y se corrige si una miniatura pasó a mostrar otro video.

const BADGE = 'acx-badge'
const CHIP = 'acx-chip'
const VIDEO_ID = /^[\w-]{11}$/

const scores = new Map() // id -> puntaje, o null si no tiene
const missingAt = new Map() // id -> cuándo no hubo puntaje; se reintenta después de un rato
/** Un video sin cifras (en vivo, recién estrenado) se vuelve a pedir pasado este tiempo. */
const RETRY_MISSING_MS = 10 * 60_000
/** Antes de esto un video recién publicado no ha tenido tiempo de compararse con su canal. */
const NEW_HOURS = 48
const pending = new Set()
let options = { enabled: true, minScore: 0, connected: false }
let requestTimer = 0
let scanTimer = 0

function videoFromHref(href) {
  if (!href) return null
  let url
  try {
    url = new URL(href, location.origin)
  } catch {
    return null
  }
  if (url.pathname === '/watch') {
    const id = url.searchParams.get('v')
    return id && VIDEO_ID.test(id) ? { id, short: false } : null
  }
  const shorts = /^\/shorts\/([\w-]{11})/.exec(url.pathname)
  return shorts ? { id: shorts[1], short: true } : null
}

const numberFormat = new Intl.NumberFormat('es', { maximumFractionDigits: 0, useGrouping: 'always' })
const compactFormat = new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 })

function scoreText(score) {
  if (score >= 100) return `${Math.round(score)}×`
  return `${score.toLocaleString('es', { maximumFractionDigits: 1, minimumFractionDigits: score < 10 ? 1 : 0 })}×`
}

function tier(rawScore) {
  // Se clasifica con el valor que se muestra: un 0,98 aparece como 1,0× y debe verse igual que un 1,0×.
  const score = rawScore >= 100 ? Math.round(rawScore) : Math.round(rawScore * 10) / 10
  if (score >= 10) return 'top'
  if (score >= 2) return 'high'
  if (score >= 1) return 'mid'
  return 'low'
}

const ageHours = (entry) => (Date.now() - new Date(entry.publishedAt).getTime()) / 3_600_000

/** Recién publicado y todavía por debajo de lo normal: es pronto para juzgarlo, no un fracaso. */
function isNew(entry) {
  return entry && entry.score !== null && ageHours(entry) < NEW_HOURS && entry.score < 1
}

function visible(entry) {
  if (!options.enabled || !options.connected || !entry || entry.score === null) return false
  if (isNew(entry)) return options.minScore === 0
  return entry.score >= options.minScore
}

function ageText(entry) {
  const hours = ageHours(entry)
  if (hours < 1) return `hace ${Math.max(1, Math.round(hours * 60))} min`
  if (hours < 48) return `hace ${Math.round(hours)} h`
  const days = Math.round(hours / 24)
  if (days < 60) return `hace ${days} días`
  const months = Math.round(days / 30)
  return months < 24 ? `hace ${months} meses` : `hace ${Math.round(days / 365)} años`
}

// Miniaturas

function thumbnailAnchors() {
  const anchors = document.querySelectorAll('a[href*="/watch?v="], a[href*="/shorts/"]')
  return [...anchors].filter(
    (a) => a.querySelector('img, yt-image, yt-thumbnail-view-model') && !a.closest('#movie_player, .ytp-ce-element'),
  )
}

function paintBadge(anchor, video) {
  let badge = anchor.querySelector(`:scope > .${BADGE}`)
  const entry = video ? scores.get(video.id) : undefined
  if (!video || !visible(entry)) {
    badge?.remove()
    return
  }
  if (!badge) {
    badge = document.createElement('span')
    badge.className = BADGE
    badge.innerHTML = '<span class="acx-dot"></span><span class="acx-value"></span>'
    badge.addEventListener('mouseenter', () => showCard(badge))
    badge.addEventListener('mouseleave', hideCard)
    if (getComputedStyle(anchor).position === 'static') anchor.classList.add('acx-anchor')
    anchor.appendChild(badge)
  }
  // Solo se toca lo que cambió: cada cambio despierta al observador de la página.
  const fresh = isNew(entry)
  const text = fresh ? 'Nuevo' : scoreText(entry.score)
  const level = fresh ? 'new' : tier(entry.score)
  const value = badge.querySelector('.acx-value')
  if (badge.dataset.tier !== level) badge.dataset.tier = level
  if (value.textContent !== text) value.textContent = text
  if (badge.dataset.video !== video.id) badge.dataset.video = video.id
}

// Tarjeta al pasar el mouse por la insignia

let card = null

function cardHtml(entry) {
  const unit = entry.short ? 'Short' : 'video'
  const rows = [
    ['Vistas', numberFormat.format(entry.views)],
    [`Lo normal por ${unit}`, numberFormat.format(Math.round(entry.baseline))],
    ['Vistas por hora', numberFormat.format(Math.round(entry.viewsPerHour))],
    ['Publicado', ageText(entry)],
  ]
  const head = isNew(entry)
    ? '<p class="acx-card-head">Recién publicado</p><p class="acx-card-note">Todavía es pronto para compararlo con su canal.</p>'
    : `<p class="acx-card-head"><span class="acx-card-score">${escapeHtml(scoreText(entry.score))}</span> lo normal del canal</p>`
  return (
    head +
    `<dl>${rows.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}</dl>`
  )
}

function showCard(badge) {
  const entry = scores.get(badge.dataset.video)
  if (!entry || entry.score === null) return
  if (!card) {
    card = document.createElement('div')
    card.className = 'acx-card'
    card.setAttribute('role', 'tooltip')
    document.body.appendChild(card)
  }
  card.dataset.tier = isNew(entry) ? 'new' : tier(entry.score)
  card.innerHTML = cardHtml(entry)
  const box = badge.getBoundingClientRect()
  card.style.visibility = 'hidden'
  card.hidden = false
  const width = card.offsetWidth
  const height = card.offsetHeight
  const left = Math.min(box.left, window.innerWidth - width - 8)
  const below = box.bottom + 6
  const top = below + height > window.innerHeight - 8 ? box.top - height - 6 : below
  card.style.left = `${Math.max(8, left)}px`
  card.style.top = `${Math.max(8, top)}px`
  card.style.visibility = ''
}

function hideCard() {
  if (card) card.hidden = true
}

window.addEventListener('scroll', hideCard, { passive: true })

// Página de un video

function currentVideo() {
  return location.pathname === '/watch' ? videoFromHref(location.href) : null
}

const infos = new Map() // id -> { tags, saved, followed } | 'loading' | { error }
const chipState = { tagsOpen: false, busy: '', message: '', copied: false, video: '' }

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

async function loadInfo(video, entry) {
  infos.set(video.id, 'loading')
  try {
    const reply = await chrome.runtime.sendMessage({ type: 'video', id: video.id, channelId: entry?.channelId })
    infos.set(video.id, reply?.ok ? reply : { error: reply?.error ?? 'No se pudo leer el video.' })
  } catch {
    infos.delete(video.id)
  }
  paintChip()
}

function chipHtml(video, entry, info) {
  const parts = []
  if (entry === null || entry.score === null) {
    parts.push('<p class="acx-chip-line"><span class="acx-chip-text">Este canal tiene muy pocos videos para saber qué es normal en él.</span></p>')
  } else if (isNew(entry)) {
    parts.push(
      `<p class="acx-chip-line"><span class="acx-chip-score">Nuevo</span><span class="acx-chip-text">Publicado ${escapeHtml(
        ageText(entry),
      )}: todavía es pronto para compararlo. Lleva ${escapeHtml(compactFormat.format(entry.views))} vistas; lo normal en este canal es ${escapeHtml(
        compactFormat.format(entry.baseline),
      )}.</span></p>`,
    )
  } else {
    parts.push(
      `<p class="acx-chip-line"><span class="acx-dot"></span><span class="acx-chip-score">${escapeHtml(scoreText(entry.score))}</span>` +
        `<span class="acx-chip-text">${escapeHtml(compactFormat.format(entry.views))} vistas, frente a ${escapeHtml(
          compactFormat.format(entry.baseline),
        )} normales en este canal${entry.short ? ' para un Short' : ''}</span></p>`,
    )
  }
  if (info && info !== 'loading' && !info.error) {
    const busy = chipState.busy
    const tags = info.tags ?? []
    parts.push('<div class="acx-actions">')
    parts.push(
      `<button type="button" class="acx-button" data-act="save" aria-pressed="${info.saved}" ${busy ? 'disabled' : ''}>` +
        `${busy === 'save' ? 'Guardando' : info.saved ? 'Guardado' : 'Guardar'}</button>`,
    )
    if (entry?.channelId) {
      parts.push(
        info.followed
          ? '<span class="acx-state">Sigues este canal</span>'
          : `<button type="button" class="acx-button" data-act="follow" ${busy ? 'disabled' : ''}>${busy === 'follow' ? 'Siguiendo' : 'Seguir canal'}</button>`,
      )
    }
    parts.push(
      tags.length > 0
        ? `<button type="button" class="acx-button acx-ghost" data-act="tags" aria-expanded="${chipState.tagsOpen}">Etiquetas <span class="acx-count">${tags.length}</span></button>`
        : '<span class="acx-state">Sin etiquetas</span>',
    )
    parts.push('</div>')
    if (chipState.message) parts.push(`<p class="acx-message" role="alert">${escapeHtml(chipState.message)}</p>`)
    if (chipState.tagsOpen && tags.length > 0) {
      parts.push(
        `<div class="acx-tags"><ul>${tags.map((t) => tagItem(t, info.hits ?? {})).join('')}</ul>` +
          (Object.keys(info.hits ?? {}).length > 0
            ? '<p class="acx-tags-note"><span class="acx-hit-dot"></span>También la usan outliers de tus canales</p>'
            : '') +
          ((info.missing ?? []).length > 0
            ? `<p class="acx-tags-note">Usan tus outliers y este video no:</p><ul class="acx-missing">${info.missing
                .map((w) => `<li title="${escapeHtml(wordTitle(w))}">${escapeHtml(w.text)}</li>`)
                .join('')}</ul>`
            : '') +
          `<button type="button" class="acx-button acx-ghost" data-act="copy">${chipState.copied ? 'Copiadas' : 'Copiar etiquetas'}</button></div>`,
      )
    }
  }
  return parts.join('')
}

/** "En 4 outliers de tus canales, 9× en promedio". */
function wordTitle(w) {
  const n = w.outliers === 1 ? '1 outlier' : `${w.outliers} outliers`
  return `En ${n} de tus canales, ${String(w.avgScore).replace('.', ',')}× en promedio`
}

function tagItem(tag, hits) {
  const hit = hits[tag.toLowerCase().replace(/\s+/g, ' ').trim()]
  return hit
    ? `<li class="acx-hit" title="${escapeHtml(wordTitle(hit))}"><span class="acx-hit-dot"></span>${escapeHtml(tag)}</li>`
    : `<li>${escapeHtml(tag)}</li>`
}

function paintChip() {
  const video = currentVideo()
  const title = document.querySelector('ytd-watch-metadata #title')
  let chip = document.querySelector(`.${CHIP}`)
  const entry = video ? scores.get(video.id) : undefined
  if (!video || !title || !options.enabled || !options.connected || entry === undefined) {
    chip?.remove()
    return
  }
  if (chipState.video !== video.id) Object.assign(chipState, { tagsOpen: false, busy: '', message: '', copied: false, video: video.id })
  if (!infos.has(video.id)) loadInfo(video, entry)
  const info = infos.get(video.id)

  if (!chip || chip.parentElement !== title) {
    chip?.remove()
    chip = document.createElement('div')
    chip.className = CHIP
    chip.addEventListener('click', onChipClick)
    title.appendChild(chip)
  }
  const html = chipHtml(video, entry, info)
  const key = `${video.id}|${html}`
  if (chip.dataset.key === key) return
  chip.dataset.key = key
  chip.dataset.tier = entry === null || entry.score === null ? 'none' : isNew(entry) ? 'new' : tier(entry.score)
  chip.innerHTML = html
}

async function onChipClick(event) {
  const button = event.target.closest('button[data-act]')
  const video = currentVideo()
  if (!button || !video) return
  const info = infos.get(video.id)
  const entry = scores.get(video.id)
  if (!info || info === 'loading' || info.error) return
  const act = button.dataset.act

  if (act === 'tags') {
    chipState.tagsOpen = !chipState.tagsOpen
    return paintChip()
  }
  if (act === 'copy') {
    try {
      await navigator.clipboard.writeText(info.tags.join(', '))
      chipState.copied = true
      setTimeout(() => ((chipState.copied = false), paintChip()), 1500)
    } catch {
      chipState.message = 'No se pudieron copiar. Selecciónalas y cópialas a mano.'
    }
    return paintChip()
  }

  chipState.busy = act
  chipState.message = ''
  paintChip()
  const message =
    act === 'save'
      ? { type: 'save', id: video.id, short: false, saved: !info.saved }
      : { type: 'follow', id: video.id, channelId: entry?.channelId }
  let reply
  try {
    reply = await chrome.runtime.sendMessage(message)
  } catch {
    reply = { ok: false, error: 'La extensión se actualizó. Recarga la página.' }
  }
  chipState.busy = ''
  if (reply?.ok) infos.set(video.id, { ...info, ...(act === 'save' ? { saved: reply.saved } : { followed: true }) })
  else chipState.message = reply?.error ?? 'No se pudo completar.'
  paintChip()
}

// Pedir puntajes

function request(videos) {
  const now = Date.now()
  for (const v of videos) {
    const stale = scores.get(v.id) === null && now - (missingAt.get(v.id) ?? 0) > RETRY_MISSING_MS
    if (!scores.has(v.id) || stale) pending.add(JSON.stringify(v))
  }
  if (pending.size === 0) return
  clearTimeout(requestTimer)
  requestTimer = setTimeout(flush, 350)
}

async function flush() {
  const batch = [...pending].map((s) => JSON.parse(s))
  pending.clear()
  if (batch.length === 0 || !options.enabled || !options.connected) return
  let reply
  try {
    reply = await chrome.runtime.sendMessage({ type: 'scores', videos: batch })
  } catch {
    return // La extensión se actualizó o se recargó: esta pestaña ya no puede hablar con ella.
  }
  if (!reply?.ok) return
  for (const v of batch) {
    const entry = reply.scores[v.id] ?? null
    scores.set(v.id, entry)
    if (entry === null) missingAt.set(v.id, Date.now())
    else missingAt.delete(v.id)
  }
  paintAll()
}

function paintAll() {
  for (const anchor of thumbnailAnchors()) paintBadge(anchor, videoFromHref(anchor.getAttribute('href')))
  paintChip()
}

function scan() {
  const anchors = thumbnailAnchors()
  const wanted = []
  for (const anchor of anchors) {
    const video = videoFromHref(anchor.getAttribute('href'))
    paintBadge(anchor, video)
    if (video) wanted.push(video)
  }
  const watching = currentVideo()
  if (watching) wanted.unshift(watching)
  paintChip()
  if (options.enabled && options.connected) request(wanted)
}

function scheduleScan() {
  clearTimeout(scanTimer)
  scanTimer = setTimeout(scan, 250)
}

async function loadOptions() {
  const stored = await chrome.storage.local.get(['enabled', 'minScore', 'connected'])
  options = { enabled: stored.enabled ?? true, minScore: stored.minScore ?? 0, connected: stored.connected ?? false }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  if (!['enabled', 'minScore', 'connected', 'token', 'appUrl'].some((k) => k in changes)) return
  if ('connected' in changes || 'token' in changes || 'appUrl' in changes) {
    scores.clear()
    infos.clear()
  }
  loadOptions().then(scan)
})

new MutationObserver(scheduleScan).observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['href'],
})
window.addEventListener('yt-navigate-finish', scheduleScan)

loadOptions().then(scan)
