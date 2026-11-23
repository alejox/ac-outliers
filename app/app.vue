<script setup lang="ts">
import type { Channel, ScoredVideo } from '~~/shared/outliers'

type Format = 'long' | 'short' | 'all'
type Sort = 'score' | 'velocity' | 'views'

const PAGE_SIZE = 40

const { data, error: loadError, refresh } = await useFetch('/api/outliers')

const channels = computed<Channel[]>(() => data.value?.channels ?? [])
const videos = computed<ScoredVideo[]>(() => data.value?.videos ?? [])
const isDemo = computed(() => data.value?.demo ?? false)
const isOpen = computed(() => data.value?.open ?? false)
const needsLogin = computed(() => loadError.value?.statusCode === 401)
const channelById = computed(() => new Map(channels.value.map((c) => [c.id, c])))

// Filtros
const format = ref<Format>('long')
const periodDays = ref(90)
const minScore = ref(2)
const sort = ref<Sort>('score')
const onlyChannel = ref<string | null>(null)
const shown = ref(PAGE_SIZE)

const results = computed(() => {
  const list = videos.value.filter((v) => {
    if (format.value !== 'all' && v.isShort !== (format.value === 'short')) return false
    if (periodDays.value > 0 && v.ageDays > periodDays.value) return false
    if (onlyChannel.value && v.channelId !== onlyChannel.value) return false
    if (minScore.value > 0 && (v.score === null || v.score < minScore.value)) return false
    return true
  })
  const key: Record<Sort, (v: ScoredVideo) => number> = {
    score: (v) => v.score ?? -1,
    velocity: (v) => v.viewsPerDay,
    views: (v) => v.views,
  }
  return list.sort((a, b) => key[sort.value](b) - key[sort.value](a))
})

watch([format, periodDays, minScore, sort, onlyChannel], () => (shown.value = PAGE_SIZE))

const summary = computed(() => {
  const n = results.value.length
  const what = n === 1 ? '1 video' : `${n} videos`
  const over = minScore.value > 0 ? ` por encima de ${formatScore(minScore.value)}` : ''
  const when = periodDays.value > 0 ? ` publicados en ${periodLabel(periodDays.value)}` : ''
  return `${what}${over}${when}`
})

// Acciones
const newChannel = ref('')
const busy = ref<'add' | 'sync' | null>(null)
const progress = ref('')
const notice = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)

const messageOf = (err: any) => err?.data?.message ?? 'Algo falló. Vuelve a intentar.'

async function addChannel() {
  if (!newChannel.value.trim() || busy.value) return
  busy.value = 'add'
  notice.value = null
  try {
    const res = await $fetch('/api/channels', { method: 'POST', body: { input: newChannel.value } })
    newChannel.value = ''
    await refresh()
    notice.value = { kind: 'ok', text: `Agregaste ${res.channel.title} con ${res.videos} videos.` }
  } catch (err) {
    notice.value = { kind: 'error', text: messageOf(err) }
  } finally {
    busy.value = null
  }
}

async function removeChannel(channel: Channel) {
  if (busy.value) return
  notice.value = null
  try {
    await $fetch(`/api/channels/${channel.id}`, { method: 'DELETE' })
    if (onlyChannel.value === channel.id) onlyChannel.value = null
    await refresh()
    notice.value = { kind: 'ok', text: `Quitaste ${channel.title}.` }
  } catch (err) {
    notice.value = { kind: 'error', text: messageOf(err) }
  }
}

async function updateAll() {
  if (busy.value || channels.value.length === 0) return
  busy.value = 'sync'
  notice.value = null
  const list = [...channels.value]
  try {
    for (const [i, channel] of list.entries()) {
      progress.value = `Actualizando ${i + 1} de ${list.length}`
      await $fetch(`/api/channels/${channel.id}/sync`, { method: 'POST' })
    }
    notice.value = { kind: 'ok', text: 'Datos actualizados.' }
  } catch (err) {
    notice.value = { kind: 'error', text: messageOf(err) }
  } finally {
    await refresh()
    busy.value = null
    progress.value = ''
  }
}

// Entrada con contraseña
const password = ref('')
const loginError = ref('')
const loggingIn = ref(false)

async function logIn() {
  if (!password.value || loggingIn.value) return
  loggingIn.value = true
  loginError.value = ''
  try {
    await $fetch('/api/login', { method: 'POST', body: { password: password.value } })
    password.value = ''
    await refresh()
  } catch (err) {
    loginError.value = messageOf(err)
  } finally {
    loggingIn.value = false
  }
}

// Formato
const compact = new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 })
const relative = new Intl.RelativeTimeFormat('es', { numeric: 'always' })

function formatScore(score: number) {
  const digits = score < 10 && !Number.isInteger(score) ? 1 : 0
  return `${score.toLocaleString('es', { minimumFractionDigits: digits, maximumFractionDigits: digits })}×`
}

function periodLabel(days: number) {
  return days === 365 ? 'el último año' : `los últimos ${days} días`
}

function formatAge(days: number) {
  if (days < 1) return 'hoy'
  if (days < 30) return relative.format(-Math.floor(days), 'day')
  if (days < 365) return relative.format(-Math.floor(days / 30), 'month')
  return relative.format(-Math.floor(days / 365), 'year')
}

function formatDuration(total: number) {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

function tier(score: number | null) {
  if (score === null) return 'none'
  if (score >= 10) return 'extreme'
  if (score >= 3) return 'high'
  if (score >= 1.5) return 'above'
  return 'normal'
}

// La regla va de 0,25× a 32× en escala logarítmica; lo normal (1×) cae al 28,6 %.
const STRIP_MIN = -2
const STRIP_SPAN = 7
const NORMAL_AT = (-STRIP_MIN / STRIP_SPAN) * 100
function stripPosition(score: number) {
  const clamped = Math.min(Math.max(Math.log2(Math.max(score, 0.01)), STRIP_MIN), STRIP_MIN + STRIP_SPAN)
  return ((clamped - STRIP_MIN) / STRIP_SPAN) * 100
}
function stripFill(score: number) {
  const pos = stripPosition(score)
  return { left: `${Math.min(pos, NORMAL_AT)}%`, width: `${Math.abs(pos - NORMAL_AT)}%` }
}

function hueOf(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return (h * 137) % 360
}

const videoUrl = (v: ScoredVideo) =>
  v.isShort ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`
</script>

<template>
  <div class="page">
    <header class="masthead">
      <h1>Outliers</h1>
      <p class="lede">Videos que rindieron muy por encima de lo normal en su propio canal.</p>
    </header>

    <p v-if="isDemo" class="banner">
      Estás viendo datos de ejemplo con canales inventados. Agrega tus claves en el archivo
      <code>.env</code> para seguir canales reales.
    </p>
    <p v-if="isOpen" class="banner">
      Esta app no tiene contraseña. Si está publicada en internet, define <code>NUXT_APP_PASSWORD</code>
      para que nadie más gaste tu cuota de YouTube.
    </p>

    <form v-if="needsLogin" class="login" @submit.prevent="logIn">
      <label for="password">Contraseña</label>
      <div class="add">
        <input id="password" v-model="password" type="password" autocomplete="current-password" :disabled="loggingIn" />
        <button class="button" type="submit" :disabled="loggingIn || !password">
          {{ loggingIn ? 'Entrando' : 'Entrar' }}
        </button>
      </div>
      <p v-if="loginError" class="notice notice-error" role="alert">{{ loginError }}</p>
    </form>

    <p v-if="loadError && !needsLogin" class="banner banner-error" role="alert">
      {{ loadError.data?.message ?? 'No se pudieron cargar los datos. Revisa la terminal del servidor.' }}
    </p>

    <section v-if="!needsLogin" class="channels" aria-labelledby="channels-title">
      <div class="section-head">
        <h2 id="channels-title">Canales que sigues</h2>
        <button
          v-if="channels.length > 0 && !isDemo"
          class="button button-quiet"
          type="button"
          :disabled="busy !== null"
          @click="updateAll"
        >
          {{ busy === 'sync' ? progress : 'Actualizar datos' }}
        </button>
      </div>

      <ul v-if="channels.length > 0" class="chips">
        <li v-for="c in channels" :key="c.id" class="chip" :class="{ 'chip-on': onlyChannel === c.id }">
          <button
            class="chip-main"
            type="button"
            :aria-pressed="onlyChannel === c.id"
            :title="onlyChannel === c.id ? 'Ver todos los canales' : `Ver solo ${c.title}`"
            @click="onlyChannel = onlyChannel === c.id ? null : c.id"
          >
            <img v-if="c.thumbnailUrl" class="avatar" :src="c.thumbnailUrl" alt="" loading="lazy" />
            <span v-else class="avatar avatar-blank" :style="{ '--hue': hueOf(c.id) }" aria-hidden="true">
              {{ c.title.charAt(0) }}
            </span>
            <span class="chip-name">{{ c.title }}</span>
            <span v-if="c.subscriberCount" class="chip-subs">{{ compact.format(c.subscriberCount) }}</span>
          </button>
          <button
            v-if="!isDemo"
            class="chip-remove"
            type="button"
            :aria-label="`Quitar ${c.title}`"
            :disabled="busy !== null"
            @click="removeChannel(c)"
          >
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </button>
        </li>
      </ul>

      <form v-if="!isDemo" class="add" @submit.prevent="addChannel">
        <label class="sr-only" for="new-channel">Canal de YouTube</label>
        <input
          id="new-channel"
          v-model="newChannel"
          type="text"
          placeholder="@usuario o enlace del canal"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :disabled="busy !== null"
        />
        <button class="button" type="submit" :disabled="busy !== null || !newChannel.trim()">
          {{ busy === 'add' ? 'Agregando' : 'Agregar canal' }}
        </button>
      </form>

      <p v-if="notice" class="notice" :class="`notice-${notice.kind}`" :role="notice.kind === 'error' ? 'alert' : 'status'">
        {{ notice.text }}
      </p>
    </section>

    <section v-if="!needsLogin" class="ranking" aria-labelledby="ranking-title">
      <h2 id="ranking-title" class="sr-only">Ranking de videos</h2>

      <div class="filters">
        <div class="segmented" role="group" aria-label="Formato">
          <button
            v-for="option in [
              { value: 'long', label: 'Videos largos' },
              { value: 'short', label: 'Shorts' },
              { value: 'all', label: 'Todo' },
            ]"
            :key="option.value"
            type="button"
            :aria-pressed="format === option.value"
            @click="format = option.value as Format"
          >
            {{ option.label }}
          </button>
        </div>

        <label class="field">
          <span>Publicados en</span>
          <select v-model.number="periodDays">
            <option :value="7">7 días</option>
            <option :value="30">30 días</option>
            <option :value="90">90 días</option>
            <option :value="365">1 año</option>
            <option :value="0">Cualquier fecha</option>
          </select>
        </label>

        <label class="field">
          <span>Score mínimo</span>
          <select v-model.number="minScore">
            <option :value="0">Sin mínimo</option>
            <option :value="1.5">1,5×</option>
            <option :value="2">2×</option>
            <option :value="3">3×</option>
            <option :value="5">5×</option>
            <option :value="10">10×</option>
          </select>
        </label>

        <label class="field">
          <span>Ordenar por</span>
          <select v-model="sort">
            <option value="score">Score</option>
            <option value="velocity">Vistas por día</option>
            <option value="views">Vistas totales</option>
          </select>
        </label>
      </div>

      <p v-if="results.length > 0" class="summary" aria-live="polite">{{ summary }}</p>

      <ol v-if="results.length > 0" class="rows">
        <li v-for="v in results.slice(0, shown)" :key="v.id" class="row" :class="`tier-${tier(v.score)}`">
          <a class="thumb" :class="{ 'thumb-short': v.isShort }" :href="videoUrl(v)" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">
            <img v-if="v.thumbnailUrl" :src="v.thumbnailUrl" alt="" loading="lazy" />
            <span v-else class="thumb-blank" :style="{ '--hue': hueOf(v.channelId) }">
              {{ channelById.get(v.channelId)?.title.charAt(0) }}
            </span>
            <span class="duration">{{ v.isShort ? 'Short' : formatDuration(v.durationSeconds) }}</span>
          </a>

          <div class="info">
            <h3>
              <a :href="videoUrl(v)" target="_blank" rel="noopener">{{ v.title }}</a>
            </h3>
            <p class="byline">
              {{ channelById.get(v.channelId)?.title }}
              <span class="age">{{ formatAge(v.ageDays) }}</span>
            </p>
            <dl class="stats">
              <div>
                <dt>Vistas</dt>
                <dd>{{ compact.format(v.views) }}</dd>
              </div>
              <div>
                <dt>Lo normal</dt>
                <dd>{{ v.baseline === null ? 'sin datos' : compact.format(v.baseline) }}</dd>
              </div>
              <div>
                <dt>Por día</dt>
                <dd>{{ compact.format(Math.round(v.viewsPerDay)) }}</dd>
              </div>
            </dl>
          </div>

          <div class="score">
            <template v-if="v.score !== null">
              <p class="score-value">{{ formatScore(v.score) }}</p>
              <div class="strip" role="img" :aria-label="`${formatScore(v.score)} de lo normal en este canal`">
                <span class="strip-fill" :style="stripFill(v.score)" />
                <span class="strip-normal" :style="{ left: `${NORMAL_AT}%` }" />
                <span class="strip-dot" :style="{ left: `${stripPosition(v.score)}%` }" />
              </div>
              <p class="strip-caption" :style="{ paddingLeft: `${NORMAL_AT}%` }" aria-hidden="true"><span>normal</span></p>
            </template>
            <p v-else class="score-missing">Pocos videos para comparar</p>
          </div>
        </li>
      </ol>

      <button v-if="results.length > shown" class="button button-quiet more" type="button" @click="shown += PAGE_SIZE">
        Ver {{ Math.min(PAGE_SIZE, results.length - shown) }} más
      </button>

      <div v-if="results.length === 0 && !loadError" class="empty">
        <template v-if="channels.length === 0">
          <p class="empty-title">Todavía no sigues ningún canal</p>
          <p>Agrega arriba los canales de tu nicho, o los tuyos, para ver qué videos se salieron de lo normal.</p>
        </template>
        <template v-else>
          <p class="empty-title">Ningún video cumple estos filtros</p>
          <p>Baja el score mínimo o amplía el periodo.</p>
        </template>
      </div>
    </section>
  </div>
</template>
