<script setup lang="ts">
import { analyzeVideo, MIN_COMPARABLE } from '~~/shared/analysis'
import type { Channel, ScoredVideo } from '~~/shared/outliers'

const props = defineProps<{
  video: ScoredVideo | null
  channel?: Channel
  /** Videos guardados del mismo canal. null mientras se cargan. */
  channelVideos: ScoredVideo[] | null
  error?: string
}>()
const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
/** Quien abrió el panel recupera el foco al cerrarlo. */
let opener: HTMLElement | null = null

const analysis = computed(() =>
  props.video && props.channelVideos ? analyzeVideo(props.video, props.channelVideos) : null,
)
const format = computed(() => (props.video?.isShort ? 'Shorts' : 'videos largos'))

watch(
  () => props.video,
  async (video, before) => {
    const el = dialog.value
    if (!el) return
    if (video && !before) {
      opener = document.activeElement as HTMLElement | null
      el.showModal()
      document.documentElement.classList.add('has-drawer')
      await nextTick()
      closeButton.value?.focus()
    } else if (!video && el.open) {
      el.close()
    }
  },
  { flush: 'post' },
)

function close() {
  emit('close')
}

/** Al cerrarse (por botón, Escape o fondo) el foco vuelve a donde estaba. */
function onClosed() {
  document.documentElement.classList.remove('has-drawer')
  if (props.video) emit('close')
  opener?.focus({ preventScroll: true })
  opener = null
}

/** Tab y Mayús+Tab dan la vuelta dentro del panel. */
function trap(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !dialog.value) return
  const focusable = [...dialog.value.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')].filter(
    (el) => el.offsetParent !== null,
  )
  if (focusable.length === 0) return
  const first = focusable[0]!
  const last = focusable[focusable.length - 1]!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

/** Un clic en el fondo oscuro (fuera del panel) lo cierra. */
function onClick(event: MouseEvent) {
  if (event.target === dialog.value) close()
}

onBeforeUnmount(() => document.documentElement.classList.remove('has-drawer'))
</script>

<template>
  <dialog
    ref="dialog"
    class="drawer"
    aria-labelledby="analysis-title"
    @cancel.prevent="close"
    @close="onClosed"
    @keydown="trap"
    @click="onClick"
  >
    <div v-if="video" class="drawer-inner">
      <div class="drawer-bar">
        <p class="drawer-kicker">Por qué destaca</p>
        <button ref="closeButton" class="button button-small" type="button" @click="close">
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          Cerrar
        </button>
      </div>

      <div class="drawer-body" :class="`tier-${scoreTier(video.score)}`">
        <div class="analysis-head">
          <a class="thumb" :href="videoUrl(video)" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">
            <img v-if="video.thumbnailUrl" :src="video.thumbnailUrl" alt="" />
            <span v-else class="thumb-blank" :style="{ '--hue': hueOf(video.channelId) }">{{ channel?.title.charAt(0) }}</span>
            <span v-if="video.isShort" class="duration duration-short">Short</span>
            <span v-else class="duration">{{ formatDuration(video.durationSeconds) }}</span>
          </a>
          <div class="analysis-title">
            <h2 id="analysis-title">
              <a :href="videoUrl(video)" target="_blank" rel="noopener">{{ video.title }}</a>
            </h2>
            <p class="byline">
              <span>{{ channel?.title }}</span>
              <span v-if="channel?.subscriberCount">{{ compact.format(channel.subscriberCount) }} suscriptores</span>
              <span>{{ formatAge(video.ageDays) }}</span>
            </p>
          </div>
        </div>

        <div class="score analysis-score">
          <p v-if="video.score !== null" class="score-value">{{ formatScore(video.score) }}</p>
          <p v-else class="score-value score-none" aria-hidden="true">–</p>
          <ScoreStrip v-if="video.score !== null" :score="video.score" />
          <p v-else class="score-missing">Pocos videos para comparar</p>
        </div>

        <p v-if="error" class="analysis-note notice-error" role="alert">{{ error }}</p>
        <p v-else-if="!analysis" class="analysis-note" aria-live="polite">Leyendo los videos guardados del canal…</p>
        <div v-else-if="!analysis.enough" class="empty analysis-empty">
          <p class="empty-title">Pocos videos del canal para comparar</p>
          <p>
            Hacen falta al menos {{ MIN_COMPARABLE }} {{ format }} guardados de este canal y hay
            {{ analysis.comparable }}.
          </p>
        </div>
        <template v-else>
          <p class="analysis-note">
            Comparado con {{ analysis.comparable }} {{ format }} guardados de {{ channel?.title ?? 'este canal' }}.
            Solo cifras, sin IA.
          </p>
          <ol class="findings">
            <li v-for="f in analysis.findings" :key="f.key" class="finding">
              <p class="finding-label">{{ f.label }}</p>
              <p class="finding-text">{{ f.text }}</p>
              <dl class="finding-figures">
                <div v-for="fig in f.figures" :key="fig.label">
                  <dt>{{ fig.label }}</dt>
                  <dd>{{ fig.value }}</dd>
                </div>
              </dl>
            </li>
          </ol>
        </template>
      </div>
    </div>
  </dialog>
</template>
