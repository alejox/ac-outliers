<script setup lang="ts">
import type { Channel, ScoredVideo } from '~~/shared/outliers'

type Format = 'long' | 'short' | 'all'
type Sort = 'score' | 'velocity' | 'views'
type Mode = 'following' | 'discover'
type FoundChannel = Channel & { followed: boolean }

const PAGE_SIZE = 40

const { data, error: loadError, refresh } = await useFetch('/api/outliers')

const channels = computed<Channel[]>(() => data.value?.channels ?? [])
const videos = computed<ScoredVideo[]>(() => data.value?.videos ?? [])
const isDemo = computed(() => data.value?.demo ?? false)
const isOpen = computed(() => data.value?.open ?? false)
const needsLogin = computed(() => loadError.value?.statusCode === 401)
const channelById = computed(() => new Map(channels.value.map((c) => [c.id, c])))

const mode = ref<Mode>('following')
const messageOf = (err: any) => err?.data?.message ?? 'Algo falló. Vuelve a intentar.'

// Ranking de los canales que sigues
const format = ref<Format>('long')
const periodDays = ref(90)
const minScore = ref(2)
const sort = ref<Sort>('score')
const onlyChannel = ref<string | null>(null)
const titleFilter = ref('')
const shown = ref(PAGE_SIZE)

const results = computed(() => {
  const words = normalizeText(titleFilter.value).split(/\s+/).filter(Boolean)
  const list = videos.value.filter((v) => {
    if (format.value !== 'all' && v.isShort !== (format.value === 'short')) return false
    if (periodDays.value > 0 && v.ageDays > periodDays.value) return false
    if (onlyChannel.value && v.channelId !== onlyChannel.value) return false
    if (minScore.value > 0 && (v.score === null || v.score < minScore.value)) return false
    if (words.length > 0) {
      const title = normalizeText(v.title)
      if (!words.every((word) => title.includes(word))) return false
    }
    return true
  })
  const key: Record<Sort, (v: ScoredVideo) => number> = {
    score: (v) => v.score ?? -1,
    velocity: (v) => v.viewsPerDay,
    views: (v) => v.views,
  }
  return list.sort((a, b) => key[sort.value](b) - key[sort.value](a))
})

watch([format, periodDays, minScore, sort, onlyChannel, titleFilter], () => (shown.value = PAGE_SIZE))

const summary = computed(() => {
  const n = results.value.length
  const what = n === 1 ? '1 video' : `${n} videos`
  const about = titleFilter.value.trim() ? ` con “${titleFilter.value.trim()}” en el título` : ''
  const over = minScore.value > 0 ? ` por encima de ${formatScore(minScore.value)}` : ''
  const when = periodDays.value > 0 ? ` publicados en ${periodLabel(periodDays.value)}` : ''
  return `${what}${about}${over}${when}`
})

// Canales
const newChannel = ref('')
const busy = ref<'add' | 'sync' | null>(null)
const progress = ref('')
const notice = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)

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
    const found = discovered.value?.channels.find((c) => c.id === channel.id)
    if (found) found.followed = false
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

// Descubrir por tema
const topic = ref('')
const topicDays = ref(90)
const searching = ref(false)
const searchError = ref('')
const searchedTopic = ref('')
const discovered = ref<{ channels: FoundChannel[]; videos: ScoredVideo[]; quotaUsed: number } | null>(null)
const following = ref<string | null>(null)

const foundChannelById = computed(() => new Map((discovered.value?.channels ?? []).map((c) => [c.id, c])))
const discoveredVideos = computed(() =>
  [...(discovered.value?.videos ?? [])].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
)
const discoveredChannelCount = computed(() => new Set(discoveredVideos.value.map((v) => v.channelId)).size)

async function searchTopic() {
  const q = topic.value.trim()
  if (q.length < 2 || searching.value) return
  searching.value = true
  searchError.value = ''
  try {
    discovered.value = await $fetch('/api/search', { query: { q, days: topicDays.value } })
    searchedTopic.value = q
  } catch (err) {
    searchError.value = messageOf(err)
  } finally {
    searching.value = false
  }
}

async function followChannel(channel: FoundChannel) {
  if (following.value) return
  following.value = channel.id
  searchError.value = ''
  try {
    await $fetch('/api/channels', { method: 'POST', body: { input: channel.id } })
    channel.followed = true
    await refresh()
  } catch (err) {
    searchError.value = messageOf(err)
  } finally {
    following.value = null
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
            @click="
              () => {
                onlyChannel = onlyChannel === c.id ? null : c.id
                mode = 'following'
              }
            "
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

      <div v-if="!isDemo" class="modes" role="group" aria-label="Dónde buscar">
        <button type="button" :aria-pressed="mode === 'following'" @click="mode = 'following'">Tus canales</button>
        <button type="button" :aria-pressed="mode === 'discover'" @click="mode = 'discover'">Descubrir por tema</button>
      </div>

      <!-- Ranking de los canales que sigues -->
      <template v-if="mode === 'following'">
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

          <label class="field field-text">
            <span>Buscar en títulos</span>
            <input v-model="titleFilter" type="search" placeholder="OBS, Claude, tutorial" autocomplete="off" />
          </label>
        </div>

        <p v-if="results.length > 0" class="summary" aria-live="polite">{{ summary }}</p>

        <ol v-if="results.length > 0" class="rows">
          <VideoRow
            v-for="v in results.slice(0, shown)"
            :key="v.id"
            :video="v"
            :channel-title="channelById.get(v.channelId)?.title ?? ''"
          />
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
            <p>Baja el score mínimo, amplía el periodo o borra el texto de búsqueda.</p>
          </template>
        </div>
      </template>

      <!-- Descubrir por tema -->
      <template v-else>
        <form class="discover" @submit.prevent="searchTopic">
          <label class="field field-text">
            <span>Tema</span>
            <input v-model="topic" type="search" placeholder="plugins de OBS" autocomplete="off" :disabled="searching" />
          </label>
          <label class="field">
            <span>Publicados en</span>
            <select v-model.number="topicDays" :disabled="searching">
              <option :value="7">7 días</option>
              <option :value="30">30 días</option>
              <option :value="90">90 días</option>
              <option :value="365">1 año</option>
              <option :value="0">Cualquier fecha</option>
            </select>
          </label>
          <button class="button" type="submit" :disabled="searching || topic.trim().length < 2">
            {{ searching ? 'Buscando' : 'Buscar en YouTube' }}
          </button>
        </form>
        <p class="hint">
          Busca videos largos en todo YouTube y los compara con lo normal de su canal. Cada búsqueda gasta unas 150
          de las 10.000 unidades diarias de tu cuota.
        </p>
        <p v-if="searchError" class="notice notice-error" role="alert">{{ searchError }}</p>

        <template v-if="discovered">
          <p v-if="discoveredVideos.length > 0" class="summary" aria-live="polite">
            {{ discoveredVideos.length === 1 ? '1 video' : `${discoveredVideos.length} videos` }} sobre “{{ searchedTopic }}”
            de {{ discoveredChannelCount === 1 ? '1 canal' : `${discoveredChannelCount} canales` }}. Gastó
            {{ discovered.quotaUsed }} unidades.
          </p>

          <ol v-if="discoveredVideos.length > 0" class="rows">
            <VideoRow
              v-for="v in discoveredVideos"
              :key="v.id"
              :video="v"
              :channel-title="foundChannelById.get(v.channelId)?.title ?? ''"
            >
              <template v-if="foundChannelById.get(v.channelId)" #default>
                <span v-if="foundChannelById.get(v.channelId)!.followed" class="followed">Ya sigues este canal</span>
                <button
                  v-else
                  class="button button-quiet button-small"
                  type="button"
                  :disabled="following !== null"
                  @click="followChannel(foundChannelById.get(v.channelId)!)"
                >
                  {{ following === v.channelId ? 'Agregando' : 'Seguir canal' }}
                </button>
              </template>
            </VideoRow>
          </ol>

          <div v-else class="empty">
            <p class="empty-title">No hay videos largos sobre “{{ searchedTopic }}”</p>
            <p>Prueba con otras palabras o amplía el periodo.</p>
          </div>
        </template>
      </template>
    </section>
  </div>
</template>
