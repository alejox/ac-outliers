<script setup lang="ts">
import type { Channel, ScoredVideo } from '~~/shared/outliers'
import { CATEGORY_OPTIONS, categoryName } from '~~/shared/categories'
import { channelStats } from '~~/shared/channel-stats'
import { applyFilters, defaultFilters, topWords } from '~~/shared/filters'

type Mode = 'following' | 'discover' | 'channels'
type FoundChannel = Channel & { followed: boolean }

const { data, error: loadError, refresh } = await useFetch('/api/outliers')

const channels = computed<Channel[]>(() => data.value?.channels ?? [])
const videos = computed<ScoredVideo[]>(() => data.value?.videos ?? [])
const isDemo = computed(() => data.value?.demo ?? false)
const isOpen = computed(() => data.value?.open ?? false)
const needsLogin = computed(() => loadError.value?.statusCode === 401)
const channelById = computed(() => new Map(channels.value.map((c) => [c.id, c])))

const mode = ref<Mode>('following')
const view = ref<'list' | 'grid'>('list')
const messageOf = (err: any) => err?.data?.message ?? 'Algo falló. Vuelve a intentar.'

const subscribersOf = (list: Channel[]) => new Map(list.map((c) => [c.id, c.subscriberCount]))
const categoriesOf = (list: ScoredVideo[]) =>
  [...new Set(list.map((v) => v.categoryId).filter((id): id is string => id !== null))]
    .map((id) => ({ id, name: categoryName(id) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
const countOf = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`)

// Ranking de los canales que sigues
const filters = ref(defaultFilters())
const onlyChannel = ref<string | null>(null)

const results = computed(() => applyFilters(videos.value, filters.value, subscribersOf(channels.value), onlyChannel.value))
const categories = computed(() => categoriesOf(videos.value))

const summary = computed(() => {
  const f = filters.value
  const about = f.title.trim() ? ` con “${f.title.trim()}” en el título` : ''
  const over = f.minScore > 0 ? ` por encima de ${formatScore(f.minScore)}` : ''
  const when = f.periodDays > 0 ? ` publicados en ${periodLabel(f.periodDays)}` : ''
  return `${countOf(results.value.length, 'video', 'videos')}${about}${over}${when}`
})

/** Palabras que se repiten en los títulos de lo que está en pantalla. Solo tiene sentido entre outliers. */
const words = computed(() =>
  filters.value.minScore > 0 && !filters.value.title.trim() ? topWords(results.value.map((v) => v.title)) : [],
)

function showChannel(channelId: string) {
  onlyChannel.value = channelId
  mode.value = 'following'
}

// Comparación de canales
const stats = computed(() => channelStats(channels.value, videos.value))

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

// Descubrir en todo YouTube
const search = reactive({ topic: '', category: '', days: 90, lang: 'es', order: 'relevance' })
const searching = ref(false)
const searchError = ref('')
const searchedFor = ref('')
const discovered = ref<{ channels: FoundChannel[]; videos: ScoredVideo[]; quotaUsed: number } | null>(null)
const following = ref<string | null>(null)
const foundFilters = ref(defaultFilters({ periodDays: 0, minScore: 0 }))

const canSearch = computed(() => search.topic.trim().length >= 2 || search.category !== '')
const foundChannelById = computed(() => new Map((discovered.value?.channels ?? []).map((c) => [c.id, c])))
const foundResults = computed(() =>
  applyFilters(discovered.value?.videos ?? [], foundFilters.value, subscribersOf(discovered.value?.channels ?? [])),
)
const foundCategories = computed(() => categoriesOf(discovered.value?.videos ?? []))
const foundSummary = computed(() => {
  const total = discovered.value?.videos.length ?? 0
  const shown = foundResults.value.length
  const count = shown === total ? countOf(total, 'video', 'videos') : `${shown} de ${countOf(total, 'video', 'videos')}`
  return `${count} de ${searchedFor.value}. Gastó ${discovered.value?.quotaUsed} unidades.`
})

async function searchYouTube() {
  if (!canSearch.value || searching.value) return
  searching.value = true
  searchError.value = ''
  const topic = search.topic.trim()
  try {
    discovered.value = await $fetch('/api/search', {
      query: { q: topic, category: search.category, days: search.days, lang: search.lang, order: search.order },
    })
    searchedFor.value = [topic && `“${topic}”`, search.category && categoryName(search.category)].filter(Boolean).join(' en ')
    foundFilters.value = defaultFilters({ periodDays: 0, minScore: 0 })
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
            @click="onlyChannel === c.id ? (onlyChannel = null) : showChannel(c.id)"
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
      <h2 id="ranking-title" class="sr-only">Videos y canales</h2>

      <div class="modes" role="group" aria-label="Sección">
        <button type="button" :aria-pressed="mode === 'following'" @click="mode = 'following'">Tus canales</button>
        <button v-if="!isDemo" type="button" :aria-pressed="mode === 'discover'" @click="mode = 'discover'">Descubrir</button>
        <button type="button" :aria-pressed="mode === 'channels'" @click="mode = 'channels'">Comparar canales</button>
      </div>

      <!-- Ranking de los canales que sigues -->
      <template v-if="mode === 'following'">
        <FilterBar v-model="filters" :categories="categories" show-format show-period />

        <p v-if="words.length > 0" class="words">
          <span>Se repite en los títulos</span>
          <button v-for="w in words" :key="w.word" type="button" class="word" @click="filters.title = w.word">
            {{ w.word }} <span class="dim">{{ w.count }}</span>
          </button>
        </p>

        <VideoResults
          v-if="results.length > 0"
          v-model:view="view"
          :videos="results"
          :channels="channelById"
          :summary="summary"
        />

        <div v-else-if="!loadError" class="empty">
          <template v-if="channels.length === 0">
            <p class="empty-title">Todavía no sigues ningún canal</p>
            <p>Agrega arriba los canales de tu nicho, o los tuyos, para ver qué videos se salieron de lo normal.</p>
          </template>
          <template v-else>
            <p class="empty-title">Ningún video cumple estos filtros</p>
            <p>Baja el score mínimo, amplía el periodo o quita algún filtro.</p>
          </template>
        </div>
      </template>

      <!-- Descubrir en todo YouTube -->
      <template v-else-if="mode === 'discover'">
        <form class="discover" @submit.prevent="searchYouTube">
          <label class="field field-text">
            <span>Tema</span>
            <input v-model="search.topic" type="search" placeholder="plugins de OBS" autocomplete="off" :disabled="searching" />
          </label>
          <label class="field">
            <span>Categoría</span>
            <select v-model="search.category" :disabled="searching">
              <option value="">Todas</option>
              <option v-for="c in CATEGORY_OPTIONS" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </label>
          <label class="field">
            <span>Publicados en</span>
            <select v-model.number="search.days" :disabled="searching">
              <option :value="7">7 días</option>
              <option :value="30">30 días</option>
              <option :value="90">90 días</option>
              <option :value="365">1 año</option>
              <option :value="0">Cualquier fecha</option>
            </select>
          </label>
          <label class="field">
            <span>Idioma</span>
            <select v-model="search.lang" :disabled="searching">
              <option value="es">Español primero</option>
              <option value="">Cualquiera</option>
            </select>
          </label>
          <label class="field">
            <span>Traer</span>
            <select v-model="search.order" :disabled="searching">
              <option value="relevance">Los más relevantes</option>
              <option value="viewCount">Los más vistos</option>
            </select>
          </label>
          <button class="button" type="submit" :disabled="searching || !canSearch">
            {{ searching ? 'Buscando' : 'Buscar en YouTube' }}
          </button>
        </form>
        <p class="hint">
          Busca videos largos en todo YouTube por tema, por categoría o por ambos, y los compara con lo normal de su
          canal. Cada búsqueda gasta unas 150 de las 10.000 unidades diarias de tu cuota.
        </p>
        <p v-if="searchError" class="notice notice-error" role="alert">{{ searchError }}</p>

        <template v-if="discovered">
          <template v-if="discovered.videos.length > 0">
            <FilterBar v-model="foundFilters" :categories="foundCategories" />

            <VideoResults
              v-if="foundResults.length > 0"
              v-model:view="view"
              :videos="foundResults"
              :channels="foundChannelById"
              :summary="foundSummary"
            >
              <template #action="{ video }">
                <template v-if="foundChannelById.get(video.channelId)">
                  <span v-if="foundChannelById.get(video.channelId)!.followed" class="followed">Ya sigues este canal</span>
                  <button
                    v-else
                    class="button button-quiet button-small"
                    type="button"
                    :disabled="following !== null"
                    @click="followChannel(foundChannelById.get(video.channelId)!)"
                  >
                    {{ following === video.channelId ? 'Agregando' : 'Seguir canal' }}
                  </button>
                </template>
              </template>
            </VideoResults>

            <div v-else class="empty">
              <p class="empty-title">Ningún resultado cumple estos filtros</p>
              <p>La búsqueda trajo {{ countOf(discovered.videos.length, 'video', 'videos') }}. Quita algún filtro para verlos.</p>
            </div>
          </template>

          <div v-else class="empty">
            <p class="empty-title">No hay videos largos de {{ searchedFor }}</p>
            <p>Prueba con otras palabras, otra categoría o un periodo más amplio.</p>
          </div>
        </template>
      </template>

      <!-- Comparar canales -->
      <template v-else>
        <template v-if="channels.length > 0">
          <p class="hint">
            Cómo le va a cada canal que sigues. Toca un encabezado para ordenar, o un canal para ver sus videos.
          </p>
          <ChannelTable :stats="stats" @select="showChannel" />
        </template>
        <div v-else class="empty">
          <p class="empty-title">Todavía no sigues ningún canal</p>
          <p>Agrega al menos dos canales arriba para compararlos.</p>
        </div>
      </template>
    </section>
  </div>
</template>
