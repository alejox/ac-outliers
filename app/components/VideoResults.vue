<script setup lang="ts">
import type { Channel, ScoredVideo } from '~~/shared/outliers'

const PAGE_SIZE = 40

const props = defineProps<{
  videos: ScoredVideo[]
  channels: Map<string, Channel>
  summary: string
}>()

/** 'list' muestra todas las cifras; 'grid' deja solo las miniaturas para estudiar el empaque. */
const view = defineModel<'list' | 'grid'>('view', { default: 'list' })

const shown = ref(PAGE_SIZE)
watch(
  () => props.videos,
  () => (shown.value = PAGE_SIZE),
)
const visible = computed(() => props.videos.slice(0, shown.value))
</script>

<template>
  <div class="results-head">
    <p class="summary" aria-live="polite">{{ summary }}</p>
    <div class="segmented segmented-small" role="group" aria-label="Vista">
      <button type="button" :aria-pressed="view === 'list'" @click="view = 'list'">Lista</button>
      <button type="button" :aria-pressed="view === 'grid'" @click="view = 'grid'">Miniaturas</button>
    </div>
  </div>

  <ol v-if="view === 'list'" class="rows">
    <VideoRow v-for="v in visible" :key="v.id" :video="v" :channel="channels.get(v.channelId)">
      <template v-if="$slots.action" #default>
        <slot name="action" :video="v" />
      </template>
    </VideoRow>
  </ol>

  <ol v-else class="grid">
    <li v-for="v in visible" :key="v.id" class="card" :class="`tier-${scoreTier(v.score)}`">
      <a class="thumb" :href="videoUrl(v)" target="_blank" rel="noopener">
        <img v-if="v.thumbnailUrl" :src="v.thumbnailUrl" alt="" loading="lazy" />
        <span v-else class="thumb-blank" :style="{ '--hue': hueOf(v.channelId) }">
          {{ channels.get(v.channelId)?.title.charAt(0) }}
        </span>
        <span v-if="v.score !== null" class="badge">{{ formatScore(v.score) }}</span>
        <span class="duration">{{ v.isShort ? 'Short' : formatDuration(v.durationSeconds) }}</span>
        <span class="sr-only">{{ v.title }}</span>
      </a>
      <p class="card-title" aria-hidden="true">{{ v.title }}</p>
      <p class="card-meta">
        <span>{{ channels.get(v.channelId)?.title }}</span>
        <span>{{ compact.format(v.views) }} vistas</span>
      </p>
    </li>
  </ol>

  <button v-if="videos.length > shown" class="button button-quiet more" type="button" @click="shown += PAGE_SIZE">
    Ver {{ Math.min(PAGE_SIZE, videos.length - shown) }} más
  </button>
</template>
