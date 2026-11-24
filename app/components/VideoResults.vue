<script setup lang="ts">
import type { Channel, ScoredVideo } from '~~/shared/outliers'

const PAGE_SIZE = 40

const props = defineProps<{
  videos: ScoredVideo[]
  channels: Map<string, Channel>
  summary: string
  /** Título del bloque cuando no lo antecede una barra de filtros. */
  heading?: string
  /** Sin barra de filtros encima, el cambio de vista va en este encabezado. */
  ownSwitch?: boolean
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
    <div class="results-title">
      <h3 v-if="heading" class="subhead">{{ heading }}</h3>
      <p class="summary" aria-live="polite">{{ summary }}</p>
    </div>
    <slot name="aside" />
    <ViewSwitch v-if="ownSwitch" v-model="view" />
  </div>

  <ol v-if="view === 'list'" class="videos">
    <VideoRow v-for="v in visible" :key="v.id" :video="v" :channel="channels.get(v.channelId)">
      <template v-if="$slots.action" #default>
        <slot name="action" :video="v" />
      </template>
    </VideoRow>
  </ol>

  <ol v-else class="tiles">
    <li v-for="v in visible" :key="v.id" class="tile" :class="`tier-${scoreTier(v.score)}`">
      <a class="thumb" :href="videoUrl(v)" target="_blank" rel="noopener">
        <img v-if="v.thumbnailUrl" :src="v.thumbnailUrl" alt="" loading="lazy" />
        <span v-else class="thumb-blank" :style="{ '--hue': hueOf(v.channelId) }">
          {{ channels.get(v.channelId)?.title.charAt(0) }}
        </span>
        <span v-if="v.isShort" class="duration duration-short">Short</span>
        <span v-else class="duration">{{ formatDuration(v.durationSeconds) }}</span>
        <span class="sr-only">{{ v.title }}</span>
      </a>
      <div class="tile-body">
        <div class="tile-score">
          <p class="tile-value">{{ v.score !== null ? formatScore(v.score) : '–' }}</p>
          <div class="strip" aria-hidden="true">
            <span v-if="v.score !== null" class="strip-fill" :style="stripFill(v.score)" />
            <span class="strip-normal" :style="{ left: `${NORMAL_AT}%` }" />
            <span v-if="v.score !== null" class="strip-dot" :style="{ left: `${stripPosition(v.score)}%` }" />
          </div>
        </div>
        <p class="tile-title" aria-hidden="true">{{ v.title }}</p>
        <p class="tile-meta">
          <span>{{ channels.get(v.channelId)?.title }}</span>
          <span>{{ compact.format(v.views) }} vistas</span>
        </p>
      </div>
    </li>
  </ol>

  <button v-if="videos.length > shown" class="button more" type="button" @click="shown += PAGE_SIZE">
    Ver {{ Math.min(PAGE_SIZE, videos.length - shown) }} más
  </button>
</template>
