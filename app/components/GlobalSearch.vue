<script setup lang="ts">
import type { Channel, ScoredVideo } from '~~/shared/outliers'

/**
 * Búsqueda de la barra superior. Filtra en el navegador lo que ya está cargado (videos, canales y
 * temas): no gasta cuota. La última opción lleva a Descubrir con el texto, para buscar en todo YouTube.
 */
const props = defineProps<{
  videos: ScoredVideo[]
  channels: Channel[]
  channelTitle: (id: string) => string | undefined
  topics: { id: string; label: string }[]
  /** Descubrir existe (no está en la demo). */
  youtube: boolean
}>()
const emit = defineEmits<{ analyze: [video: ScoredVideo]; channel: [id: string]; topic: [id: string]; youtube: [query: string] }>()

const query = ref('')
const open = ref(false)
/** En el celular el campo se despliega sobre la barra. */
const expanded = ref(false)
const active = ref(0)
const input = ref<HTMLInputElement | null>(null)

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

type Option =
  | { kind: 'video'; key: string; video: ScoredVideo }
  | { kind: 'channel'; key: string; channel: Channel }
  | { kind: 'topic'; key: string; topic: { id: string; label: string } }
  | { kind: 'youtube'; key: string }

const options = computed<Option[]>(() => {
  const q = fold(query.value.trim())
  if (q.length < 2) return []
  const seen = new Set<string>()
  const videos = props.videos
    .filter((v) => !seen.has(v.id) && seen.add(v.id) && fold(v.title).includes(q))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 5)
    .map((video) => ({ kind: 'video' as const, key: `v-${video.id}`, video }))
  const channels = props.channels
    .filter((c) => fold(c.title).includes(q))
    .slice(0, 3)
    .map((channel) => ({ kind: 'channel' as const, key: `c-${channel.id}`, channel }))
  const topics = props.topics
    .filter((t) => fold(t.label).includes(q))
    .slice(0, 3)
    .map((topic) => ({ kind: 'topic' as const, key: `t-${topic.id}`, topic }))
  const out: Option[] = [...videos, ...channels, ...topics]
  if (props.youtube) out.push({ kind: 'youtube', key: 'youtube' })
  return out
})
const showList = computed(() => open.value && query.value.trim().length >= 2)
watch(query, () => {
  active.value = 0
  open.value = true
})

function choose(o: Option | undefined) {
  if (!o) return
  if (o.kind === 'video') emit('analyze', o.video)
  else if (o.kind === 'channel') emit('channel', o.channel.id)
  else if (o.kind === 'topic') emit('topic', o.topic.id)
  else emit('youtube', query.value.trim())
  close()
  query.value = ''
}

function close() {
  open.value = false
  expanded.value = false
}

function onKey(e: KeyboardEvent) {
  const n = options.value.length
  if (e.key === 'ArrowDown' && n) {
    e.preventDefault()
    open.value = true
    active.value = (active.value + 1) % n
  } else if (e.key === 'ArrowUp' && n) {
    e.preventDefault()
    active.value = (active.value - 1 + n) % n
  } else if (e.key === 'Enter') {
    e.preventDefault()
    choose(options.value[active.value])
  } else if (e.key === 'Escape') {
    if (query.value) query.value = ''
    else {
      close()
      input.value?.blur()
    }
  }
}

async function expand() {
  expanded.value = true
  await nextTick()
  input.value?.focus()
}

/** Atajo "/": lleva a la búsqueda salvo que se esté escribiendo en otro campo. */
function onSlash(e: KeyboardEvent) {
  if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
  const t = e.target as HTMLElement | null
  if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return
  if (document.querySelector('dialog[open]')) return
  e.preventDefault()
  expand()
}
onMounted(() => window.addEventListener('keydown', onSlash))
onBeforeUnmount(() => window.removeEventListener('keydown', onSlash))

const root = ref<HTMLElement | null>(null)
function onFocusOut(e: FocusEvent) {
  if (!root.value?.contains(e.relatedTarget as Node | null)) close()
}
</script>

<template>
  <div ref="root" class="gsearch" :class="{ 'is-expanded': expanded }" @focusout="onFocusOut">
    <button class="icon-button gsearch-trigger" type="button" aria-label="Buscar" @click="expand">
      <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
        <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6" />
        <path d="m13.5 13.5 3.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      </svg>
    </button>
    <div class="gsearch-field">
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
        <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6" />
        <path d="m13.5 13.5 3.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      </svg>
      <input
        ref="input"
        v-model="query"
        type="search"
        role="combobox"
        aria-label="Buscar en tus videos, canales y temas"
        aria-autocomplete="list"
        aria-controls="gsearch-list"
        :aria-expanded="showList"
        :aria-activedescendant="showList && options[active] ? `gs-${options[active]!.key}` : undefined"
        placeholder="Busca un video, un canal o un tema"
        autocomplete="off"
        spellcheck="false"
        @focus="open = true"
        @keydown="onKey"
      />
      <kbd aria-hidden="true">/</kbd>
      <button class="icon-button gsearch-close" type="button" aria-label="Cerrar la búsqueda" @click="close">
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <ul v-show="showList" id="gsearch-list" class="gsearch-list" role="listbox" aria-label="Resultados">
      <li v-if="options.length === 0 || (options.length === 1 && youtube)" class="gsearch-empty" role="presentation">
        Nada con “{{ query.trim() }}” en lo que ya tienes cargado.
      </li>
      <li
        v-for="(o, i) in options"
        :id="`gs-${o.key}`"
        :key="o.key"
        role="option"
        class="gsearch-option"
        :class="{ 'is-active': i === active, 'is-youtube': o.kind === 'youtube' }"
        :aria-selected="i === active"
        @mousedown.prevent
        @mouseenter="active = i"
        @click="choose(o)"
      >
        <template v-if="o.kind === 'video'">
          <VideoThumb class="gsearch-thumb" :src="o.video.thumbnailUrl" :title="o.video.title" :seed="o.video.channelId" plain />
          <span class="gsearch-text">
            <span class="gsearch-title">{{ o.video.title }}</span>
            <span class="gsearch-sub">{{ channelTitle(o.video.channelId) ?? 'Video' }}</span>
          </span>
          <span v-if="o.video.score !== null" class="gsearch-score" :class="`is-${badgeTier(o.video.score)}`">{{ formatScore(o.video.score) }}</span>
        </template>
        <template v-else-if="o.kind === 'channel'">
          <img v-if="o.channel.thumbnailUrl" class="gsearch-avatar" :src="o.channel.thumbnailUrl" alt="" />
          <span v-else class="gsearch-avatar" :style="{ '--hue': hueOf(o.channel.id) }" aria-hidden="true">{{ o.channel.title.charAt(0) }}</span>
          <span class="gsearch-text">
            <span class="gsearch-title">{{ o.channel.title }}</span>
            <span class="gsearch-sub">Canal que sigues · ver sus videos</span>
          </span>
        </template>
        <template v-else-if="o.kind === 'topic'">
          <span class="gsearch-avatar gsearch-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20" width="18" height="18"><path d="M3 14l5-5 3.5 3.5L17 7M13 7h4v4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </span>
          <span class="gsearch-text">
            <span class="gsearch-title">{{ o.topic.label }}</span>
            <span class="gsearch-sub">Tema que sigues · ver tendencias</span>
          </span>
        </template>
        <template v-else>
          <span class="gsearch-avatar gsearch-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20" width="18" height="18"><circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="m13.5 13.5 3.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
          </span>
          <span class="gsearch-text">
            <span class="gsearch-title">Buscar “{{ query.trim() }}” en todo YouTube</span>
            <span class="gsearch-sub">Abre Descubrir con este texto. Buscar gasta cuota.</span>
          </span>
        </template>
      </li>
    </ul>
  </div>
</template>
