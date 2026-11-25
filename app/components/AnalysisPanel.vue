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
const saver = inject<{
  enabled: Ref<boolean>
  isSaved: (id: string) => boolean
  busy: Ref<string | null>
  toggle: (video: ScoredVideo) => void
} | null>('saver', null)
const format = computed(() => (props.video?.isShort ? 'Shorts' : 'videos largos'))

// Cambios de título y miniatura: solo se piden si la fila ya sabe que el video cambió.
type Change = { kind: 'title' | 'thumbnail'; before: string | null; after: string | null; changedAt: string }
const videoChanges = inject<Ref<Record<string, unknown[]>> | null>('videoChanges', null)
const changes = ref<Change[]>([])
watch(
  () => props.video?.id,
  async (id) => {
    changes.value = []
    if (!id || !videoChanges?.value[id]?.length) return
    try {
      const res = await $fetch<{ changes: Change[] }>('/api/video-changes', { query: { id } })
      if (props.video?.id === id) changes.value = res.changes
    } catch {
      // Sin cambios que mostrar; el resto del análisis sigue igual.
    }
  },
  { immediate: true },
)
const ageOf = (at: string) => formatAge((Date.now() - new Date(at).getTime()) / 86_400_000)

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
        <button ref="closeButton" class="icon-button drawer-close" type="button" aria-label="Cerrar" @click="close">
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <div class="drawer-body" :class="`is-${badgeTier(video.score)}`">
        <a class="analysis-thumb" :href="videoUrl(video)" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">
          <VideoThumb
            :src="video.thumbnailUrl"
            :title="video.title"
            :seed="video.channelId"
            plain
            :duration="video.isShort ? 'Short' : formatDuration(video.durationSeconds)"
          />
        </a>
        <h2 id="analysis-title" class="analysis-title">
          <a :href="videoUrl(video)" target="_blank" rel="noopener">{{ video.title }}</a>
        </h2>
        <p class="analysis-by">
          <span>{{ channel?.title }}</span>
          <span v-if="channel?.subscriberCount">{{ compact.format(channel.subscriberCount) }} suscriptores</span>
          <span>{{ formatAge(video.ageDays) }}</span>
        </p>

        <div class="analysis-score">
          <p v-if="video.score !== null" class="analysis-value">{{ formatScore(video.score) }}</p>
          <p v-else class="analysis-value score-none" aria-hidden="true">–</p>
          <p class="analysis-phrase">
            <b>{{ compact.format(video.views) }} vistas</b>
            <template v-if="video.baseline !== null"> donde lo normal del canal son {{ compact.format(video.baseline) }}</template>
            <template v-else>. Pocos videos para comparar.</template>
          </p>
          <div v-if="video.score !== null" class="analysis-rule">
            <ScoreStrip :score="video.score" />
            <p class="strip-scale" aria-hidden="true">
              <span :style="{ left: `${NORMAL_AT}%` }">lo normal</span>
              <span v-for="m in [4, 16]" :key="m" :style="{ left: `${stripPosition(m)}%` }">{{ m }}×</span>
            </p>
          </div>
        </div>

        <div class="analysis-actions">
          <button
            v-if="saver?.enabled.value"
            class="button button-primary"
            type="button"
            :aria-pressed="saver.isSaved(video.id)"
            :disabled="saver.busy.value !== null"
            @click="saver.toggle(video)"
          >
            {{ saver.busy.value === video.id ? 'Guardando' : saver.isSaved(video.id) ? 'Guardado' : 'Guardar' }}
          </button>
          <a class="button" :href="videoUrl(video)" target="_blank" rel="noopener">Abrir en YouTube</a>
        </div>

        <section v-if="changes.length > 0" class="changes" aria-labelledby="changes-title">
          <h3 id="changes-title" class="changes-title">Cambios del creador</h3>
          <ol class="changes-list">
            <li v-for="(c, i) in changes" :key="i" class="change">
              <p class="change-head">
                {{ c.kind === 'title' ? 'Cambió el título' : 'Cambió la miniatura' }} <span class="change-age">{{ ageOf(c.changedAt) }}</span>
              </p>
              <dl v-if="c.kind === 'title'" class="change-titles">
                <div><dt>Antes</dt><dd>{{ c.before }}</dd></div>
                <div><dt>Ahora</dt><dd>{{ c.after }}</dd></div>
              </dl>
              <div v-else class="change-thumbs">
                <figure>
                  <img v-if="c.before" :src="c.before" alt="Miniatura anterior" />
                  <span v-else class="change-missing">Sin copia</span>
                  <figcaption>Antes</figcaption>
                </figure>
                <figure>
                  <img v-if="c.after" :src="c.after" alt="Miniatura nueva" />
                  <span v-else class="change-missing">Sin copia</span>
                  <figcaption>Ahora</figcaption>
                </figure>
              </div>
            </li>
          </ol>
          <p class="analysis-note">Si cambió después de despegar, el score mide la versión nueva. Se revisa una vez al día.</p>
        </section>

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
