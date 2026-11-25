<script setup lang="ts">
/** 'grid' muestra tarjetas con la miniatura grande; 'list' tumba la tarjeta y deja ver todas las cifras. */
const view = defineModel<'list' | 'grid'>({ required: true })
</script>

<template>
  <div class="view-toggle" role="group" aria-label="Vista">
    <button type="button" title="Miniaturas" :aria-pressed="view === 'grid'" @click="view = 'grid'">
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path
          d="M2.75 2.75h4v4h-4zM9.25 2.75h4v4h-4zM2.75 9.25h4v4h-4zM9.25 9.25h4v4h-4z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
      </svg>
      <span class="sr-only">Miniaturas</span>
    </button>
    <button type="button" title="Lista" :aria-pressed="view === 'list'" @click="view = 'list'">
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M2.75 4h10.5M2.75 8h10.5M2.75 12h10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      <span class="sr-only">Lista</span>
    </button>
  </div>
</template>
