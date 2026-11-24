<script setup lang="ts">
import type { Channel } from '~~/shared/outliers'

defineProps<{
  channel?: Channel & { followed: boolean }
  /** ID del canal que se está agregando en este momento, si hay alguno. */
  busyId: string | null
}>()
defineEmits<{ follow: [channelId: string] }>()
</script>

<template>
  <template v-if="channel">
    <span v-if="channel.followed" class="followed">Ya sigues este canal</span>
    <button
      v-else
      class="button button-quiet button-small"
      type="button"
      :disabled="busyId !== null"
      @click="$emit('follow', channel.id)"
    >
      {{ busyId === channel.id ? 'Agregando' : 'Seguir canal' }}
    </button>
  </template>
</template>
