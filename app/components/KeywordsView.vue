<script setup lang="ts">
import { matchesTerm, outlierKeywords, tagChars, tagsToCopy, TAG_CHAR_LIMIT, type Keyword } from '~~/shared/keywords'
import type { Channel, ScoredVideo, Topic } from '~~/shared/outliers'

const props = defineProps<{
  /** Videos de tus canales (para las miniaturas de ejemplo). */
  videos: ScoredVideo[]
  channels: Channel[]
  /** Resultados de tus temas, con etiquetas. */
  trendVideos: ScoredVideo[]
  topics: Topic[]
  topicLabel: (t: Topic) => string
  hasMyChannel: boolean
  isDemo: boolean
}>()
defineEmits<{ analyze: [video: ScoredVideo]; go: [mode: 'following' | 'trends'] }>()

/** 'channels' = todos tus canales; 'channel:<id>'; 'topics' = todos tus temas; 'topic:<id>'. */
const messageOf = (err: any) => err?.data?.message ?? 'Algo falló. Vuelve a intentar.'
const scope = ref('channels')
const source = ref<'titles' | 'tags'>('titles')

type Report = { tags: Keyword[]; titles: Keyword[]; withTags: number; total: number }
const channelParam = computed(() => (scope.value.startsWith('channel:') ? scope.value.slice(8) : ''))
const { data: server, pending, error } = await useFetch<Report>('/api/keywords', {
  query: { channel: channelParam },
  lazy: true,
  server: false,
})

// Temas: se calcula aquí con los resultados guardados, que ya traen sus etiquetas.
const topicReport = computed<Report | null>(() => {
  if (!scope.value.startsWith('topic')) return null
  const id = scope.value.startsWith('topic:') ? scope.value.slice(6) : null
  const list = props.trendVideos.filter((v) => !id || (v as ScoredVideo & { topicIds?: string[] }).topicIds?.includes(id))
  const input = list.map((v) => ({ id: v.id, title: v.title, score: v.score, tags: v.tags ?? null }))
  return {
    tags: outlierKeywords(input, 'tags'),
    titles: outlierKeywords(input, 'titles'),
    withTags: input.filter((v) => v.tags && v.tags.length > 0).length,
    total: input.length,
  }
})
const report = computed(() => topicReport.value ?? (scope.value.startsWith('topic') ? null : server.value ?? null))
const words = computed(() => report.value?.[source.value] ?? [])

// Lo que buscan para encontrarte (Mi canal), para marcar las palabras que ya te traen vistas.
const searchTerms = ref<string[]>([])
onMounted(async () => {
  if (!props.hasMyChannel) return
  try {
    const res = await $fetch<{ searchTerms?: { term: string }[] }>('/api/my-channel', { query: { days: 28 } })
    searchTerms.value = (res.searchTerms ?? []).map((t) => t.term)
  } catch {
    // Sin Mi canal: las palabras se muestran igual, sin la marca.
  }
})
const isMine = (k: Keyword) => searchTerms.value.length > 0 && matchesTerm(k.text, searchTerms.value)

// Ejemplos: las miniaturas de los outliers que usan cada palabra.
const videoById = computed(() => new Map([...props.trendVideos, ...props.videos].map((v) => [v.id, v])))
const examples = (k: Keyword) => k.videoIds.map((id) => videoById.value.get(id)).filter(Boolean).slice(0, 3) as ScoredVideo[]

// Etiquetas para copiar: las primeras que caben en los 500 caracteres de YouTube, y puedes quitar o poner.
const picked = ref<Set<string>>(new Set())
watch(
  () => [report.value, source.value] as const,
  () => {
    picked.value = new Set(tagsToCopy((report.value?.tags ?? []).map((k) => k.text)))
  },
  { immediate: true },
)
const pickedList = computed(() => (report.value?.tags ?? []).map((k) => k.text).filter((t) => picked.value.has(t)))
const chars = computed(() => tagChars(pickedList.value))
function toggle(text: string) {
  const next = new Set(picked.value)
  if (next.has(text)) next.delete(text)
  else if (tagChars([...pickedList.value, text]) <= TAG_CHAR_LIMIT) next.add(text)
  picked.value = next
}
const copied = ref(false)
async function copy() {
  try {
    await navigator.clipboard.writeText(pickedList.value.join(', '))
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    copied.value = false
  }
}

const scopeName = computed(() => {
  if (scope.value === 'channels') return 'tus canales'
  if (scope.value === 'topics') return 'tus temas'
  if (scope.value.startsWith('channel:')) return props.channels.find((c) => c.id === channelParam.value)?.title ?? 'este canal'
  const t = props.topics.find((x) => `topic:${x.id}` === scope.value)
  return t ? `“${props.topicLabel(t)}”` : 'este tema'
})
const loading = computed(() => !scope.value.startsWith('topic') && pending.value && !server.value)
const maxScore = computed(() => Math.max(2, ...words.value.map((k) => k.avgScore)))
</script>

<template>
  <div class="kw">
    <div class="kw-bar">
      <label class="kw-scope">
        <span class="sr-only">De dónde salen las palabras</span>
        <select v-model="scope">
          <option value="channels">Todos tus canales</option>
          <option v-for="c in channels" :key="c.id" :value="`channel:${c.id}`">{{ c.title }}</option>
          <template v-if="topics.length > 0">
            <option value="topics">Todos tus temas</option>
            <option v-for="t in topics" :key="t.id" :value="`topic:${t.id}`">Tema: {{ topicLabel(t) }}</option>
          </template>
        </select>
      </label>
      <div class="segmented" role="group" aria-label="Qué palabras ver">
        <button type="button" :aria-pressed="source === 'titles'" @click="source = 'titles'">En los títulos</button>
        <button type="button" :aria-pressed="source === 'tags'" @click="source = 'tags'">Etiquetas</button>
      </div>
    </div>

    <p class="kw-lede">
      {{ source === 'titles' ? 'Frases que se repiten en los títulos' : 'Etiquetas que se repiten' }} de los videos que rindieron 2× o más en {{ scopeName }},
      ordenadas por cuánto rindieron y por qué tan pocas veces aparecen en videos normales.
    </p>

    <p v-if="error && !scope.startsWith('topic')" class="banner banner-error" role="alert">{{ messageOf(error) }}</p>
    <div v-else-if="loading" class="kw-loading" aria-busy="true">
      <span v-for="i in 6" :key="i" class="kw-skel" />
    </div>

    <div v-else-if="words.length === 0" class="empty">
      <template v-if="source === 'tags' && report && report.withTags === 0">
        <p class="empty-title">Las etiquetas llegan con la próxima actualización</p>
        <p>Se leen junto con los videos, sin gastar cuota extra. Pulsa “Actualizar datos” arriba o espera la actualización diaria.</p>
      </template>
      <template v-else-if="report && report.total < 8">
        <p class="empty-title">Hacen falta más videos para comparar</p>
        <p>Con pocos videos no se puede saber qué palabras comparten los outliers. Sigue más canales de tu tema o un tema completo.</p>
        <p class="empty-actions">
          <button class="button" type="button" @click="$emit('go', 'following')">Seguir canales</button>
          <button class="link-button" type="button" @click="$emit('go', 'trends')">Seguir un tema</button>
        </p>
      </template>
      <template v-else>
        <p class="empty-title">Ninguna palabra se repite en dos outliers o más</p>
        <p>Prueba con todos tus canales o con un tema: entre más videos, más claras salen.</p>
      </template>
    </div>

    <template v-else>
      <div v-if="source === 'tags'" class="kw-copy panel">
        <div>
          <p class="kw-copy-title">Copiar para YouTube Studio</p>
          <p class="kw-copy-sub">
            {{ pickedList.length }} etiquetas · {{ chars }} de {{ TAG_CHAR_LIMIT }} caracteres. Toca una etiqueta de la lista para quitarla o ponerla.
          </p>
        </div>
        <button class="button button-primary" type="button" :disabled="pickedList.length === 0" @click="copy">
          {{ copied ? 'Copiadas' : 'Copiar etiquetas' }}
        </button>
      </div>

      <ol class="kw-list">
        <li v-for="(k, i) in words" :key="k.key" class="kw-row" :class="{ 'is-picked': source === 'tags' && picked.has(k.text) }">
          <span class="kw-rank" aria-hidden="true">{{ i + 1 }}</span>
          <div class="kw-main">
            <p class="kw-word">
              <button
                v-if="source === 'tags'"
                class="kw-pick"
                type="button"
                :aria-pressed="picked.has(k.text)"
                :title="picked.has(k.text) ? 'Quitar de las etiquetas para copiar' : 'Agregar a las etiquetas para copiar'"
                @click="toggle(k.text)"
              >{{ k.text }}</button>
              <span v-else>{{ k.text }}</span>
              <span v-if="isMine(k)" class="kw-mine" title="Aparece en lo que buscan para encontrar tu canal (últimos 28 días)">Te buscan así</span>
            </p>
            <p class="kw-meta">
              <span>{{ k.outliers }} outliers</span>
              <span>{{ k.outliers }} de {{ k.videos }} videos que la usan</span>
              <span v-if="k.variants.length > 0">También: {{ k.variants.join(', ') }}</span>
            </p>
          </div>
          <div class="kw-score" :title="`Score promedio de los outliers que la usan`">
            <span class="kw-bar-track" aria-hidden="true"><span class="kw-bar-fill" :class="`is-${badgeTier(k.avgScore)}`" :style="{ width: `${(k.avgScore / maxScore) * 100}%` }" /></span>
            <strong :class="`is-${badgeTier(k.avgScore)}`">{{ formatScore(k.avgScore) }}</strong>
            <small>promedio</small>
          </div>
          <ul class="kw-examples" aria-label="Outliers que la usan">
            <li v-for="v in examples(k)" :key="v.id">
              <button type="button" :title="v.title" :aria-label="`Analizar “${v.title}”`" @click="$emit('analyze', v)">
                <VideoThumb :src="v.thumbnailUrl" :title="v.title" :seed="v.channelId" :score="v.score" />
              </button>
            </li>
          </ul>
        </li>
      </ol>

      <p class="form-note kw-note">
        YouTube dice que las etiquetas pesan poco para que te encuentren (sirven sobre todo para palabras que se escriben mal).
        Las frases de los títulos pesan más: úsalas como pista para tu próximo título, no como receta.
      </p>
    </template>
  </div>
</template>
