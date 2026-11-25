<script setup lang="ts">
import type { Channel } from '~~/shared/outliers'

defineProps<{
  channel?: Channel & { followed: boolean }
  /** ID del canal que se está agregando en este momento, si hay alguno. */
  busyId: string | null
  /** En la demo no se puede seguir nada: el botón se ve, pero explica por qué no responde. */
  demo?: boolean
}>()
const emit = defineEmits<{ follow: [channelId: string] }>()
</script>

<template>
  <template v-if="channel">
    <span v-if="channel.followed" class="followed">Ya sigues este canal</span>
    <button
      v-else-if="demo"
      class="button button-small is-unavailable"
      type="button"
      aria-disabled="true"
      title="No disponible en modo demo"
    >
      Seguir canal
    </button>
    <button
      v-else
      class="button button-small"
      type="button"
      :disabled="busyId !== null"
      @click="emit('follow', channel.id)"
    >
      {{ busyId === channel.id ? 'Agregando' : 'Seguir canal' }}
    </button>
  </template>
</template>
