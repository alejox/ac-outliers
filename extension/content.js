// Pone el score de cada video encima de su miniatura y, en la página de un video, junto al título.
// YouTube es una sola página que recicla sus elementos al navegar, así que todo se revisa
// cada vez que cambia el contenido y se corrige si una miniatura pasó a mostrar otro video.

const BADGE = 'acx-badge'
const CHIP = 'acx-chip'
const VIDEO_ID = /^[\w-]{11}$/

const scores = new Map() // id -> puntaje, o null si no tiene
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

const numberFormat = new Intl.NumberFormat('es', { maximumFractionDigits: 0 })
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

function visible(entry) {
  return options.enabled && options.connected && entry && entry.score !== null && entry.score >= options.minScore
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
    if (getComputedStyle(anchor).position === 'static') anchor.classList.add('acx-anchor')
    anchor.appendChild(badge)
  }
  // Solo se toca lo que cambió: cada cambio despierta al observador de la página.
  const text = scoreText(entry.score)
  const value = badge.querySelector('.acx-value')
  if (badge.dataset.tier !== tier(entry.score)) badge.dataset.tier = tier(entry.score)
  if (value.textContent !== text) value.textContent = text
  badge.title = `${scoreText(entry.score)} lo normal del canal: ${numberFormat.format(Math.round(entry.baseline))} vistas por ${
    entry.short ? 'Short' : 'video'
  }`
}

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
        `<div class="acx-tags"><ul>${tags.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` +
          `<button type="button" class="acx-button acx-ghost" data-act="copy">${chipState.copied ? 'Copiadas' : 'Copiar etiquetas'}</button></div>`,
      )
    }
  }
  return parts.join('')
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
  chip.dataset.tier = entry === null || entry.score === null ? 'none' : tier(entry.score)
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
  for (const v of videos) {
    if (!scores.has(v.id)) pending.add(JSON.stringify(v))
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
  for (const v of batch) scores.set(v.id, reply.scores[v.id] ?? null)
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
