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

/** 'grid' (por defecto) son tarjetas con la miniatura grande; 'list' tumba la tarjeta y muestra todas las cifras. */
const view = defineModel<'list' | 'grid'>('view', { default: 'grid' })
defineEmits<{ analyze: [video: ScoredVideo] }>()

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

  <ol class="vgrid" :class="{ 'is-list': view === 'list' }">
    <VideoRow v-for="v in visible" :key="v.id" :video="v" :channel="channels.get(v.channelId)" @analyze="$emit('analyze', $event)">
      <template v-if="$slots.action" #default>
        <slot name="action" :video="v" />
      </template>
      <template v-if="$slots.meta" #meta>
        <slot name="meta" :video="v" />
      </template>
    </VideoRow>
  </ol>

  <button v-if="videos.length > shown" class="button more" type="button" @click="shown += PAGE_SIZE">
    Ver {{ Math.min(PAGE_SIZE, videos.length - shown) }} más
  </button>
</template>
