<script setup lang="ts">
import type { Channel, ScoredVideo } from '~~/shared/outliers'

/**
 * Tarjeta de video "miniatura primero": la miniatura abre Analizar, el título abre el video en YouTube.
 * En la vista de lista la misma tarjeta se tumba y muestra la regla del score y sus cifras.
 */
const props = defineProps<{ video: ScoredVideo; channel?: Channel }>()
defineEmits<{ analyze: [video: ScoredVideo] }>()

const videoChanges = inject<Ref<Record<string, { kind: 'title' | 'thumbnail'; at: string }[]>> | null>('videoChanges', null)
const changed = computed(() => changeLabel(videoChanges?.value[props.video.id] ?? []))

/** Lo da app.vue: guardar o quitar el video de Guardados. Sin él (modo demo) no hay botón. */
const saver = inject<{
  enabled: Ref<boolean>
  isSaved: (id: string) => boolean
  busy: Ref<string | null>
  error: Ref<{ id: string; text: string } | null>
  toggle: (video: ScoredVideo) => void
} | null>('saver', null)

const openLabel = computed(
  () => `Analizar “${props.video.title}”` + (props.video.score !== null ? `, ${formatScore(props.video.score)} lo normal de su canal` : ''),
)
const duration = computed(() => (props.video.isShort ? 'Short' : formatDuration(props.video.durationSeconds)))
</script>

<template>
  <li class="vcard" :class="`is-${badgeTier(video.score)}`">
    <div class="vcard-media">
      <button class="vcard-open" type="button" :aria-label="openLabel" @click="$emit('analyze', video)">
        <VideoThumb :src="video.thumbnailUrl" :title="video.title" :seed="video.channelId" :score="video.score" :duration="duration" />
        <span class="vcard-hint" aria-hidden="true">Analizar</span>
      </button>
      <button
        v-if="saver?.enabled.value"
        class="vcard-save"
        type="button"
        :aria-pressed="saver.isSaved(video.id)"
        :disabled="saver.busy.value !== null"
        @click="saver.toggle(video)"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            d="M4.25 2.25h7.5a.5.5 0 0 1 .5.5v11l-4.25-2.75L3.75 13.75v-11a.5.5 0 0 1 .5-.5z"
            :fill="saver.isSaved(video.id) ? 'currentColor' : 'none'"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
        </svg>
        {{ saver.busy.value === video.id ? 'Guardando' : saver.isSaved(video.id) ? 'Guardado' : 'Guardar' }}<span class="sr-only"> “{{ video.title }}”</span>
      </button>
    </div>

    <div class="vcard-body">
      <img v-if="channel?.thumbnailUrl" class="vcard-avatar" :src="channel.thumbnailUrl" alt="" loading="lazy" />
      <span v-else class="vcard-avatar" :style="{ '--hue': hueOf(video.channelId) }" aria-hidden="true">{{ channel?.title.charAt(0) }}</span>
      <div class="vcard-text">
        <h3 class="vcard-title">
          <a :href="videoUrl(video)" target="_blank" rel="noopener">{{ video.title }}</a>
        </h3>
        <p class="vcard-channel">{{ channel?.title }}</p>
        <p class="vcard-data">
          <span><b>{{ compact.format(video.views) }}</b> vistas</span>
          <span>{{ formatAge(video.ageDays) }}</span>
        </p>
        <p v-if="changed" class="vcard-note">{{ changed }}</p>
        <p v-if="saver?.error.value?.id === video.id" class="vcard-error" role="alert">{{ saver.error.value.text }}</p>
        <div v-if="$slots.default || $slots.meta" class="vcard-actions">
          <slot />
          <slot name="meta" />
        </div>
      </div>
    </div>

    <div class="vcard-stats">
      <div class="vcard-rule">
        <ScoreStrip v-if="video.score !== null" :score="video.score" />
        <p v-else class="vcard-missing">Pocos videos para comparar</p>
      </div>
      <dl>
        <div>
          <dt>Score</dt>
          <dd class="vcard-score">{{ video.score !== null ? formatScore(video.score) : '–' }}</dd>
        </div>
        <div>
          <dt>Lo normal</dt>
          <dd>{{ video.baseline === null ? 'sin datos' : compact.format(video.baseline) }}</dd>
        </div>
        <div :title="video.recentPace ? 'Ritmo desde la última actualización' : 'Promedio desde que se publicó'">
          <dt>{{ video.recentPace ? 'Por hora, ahora' : 'Por hora' }}</dt>
          <dd>{{ formatPace(video.viewsPerHour) }}</dd>
        </div>
        <div v-if="video.engagement !== null" title="Likes y comentarios por cada 100 vistas">
          <dt>Interacción</dt>
          <dd>{{ formatPercent(video.engagement) }}</dd>
        </div>
      </dl>
    </div>
  </li>
</template>
