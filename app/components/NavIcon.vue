<script setup lang="ts">
/** Íconos de línea de la navegación (20 px, trazo de 1,6). */
defineProps<{ name: 'home' | 'mine' | 'trends' | 'following' | 'discover' | 'channels' | 'saved' | 'more' }>()
</script>

<template>
  <svg class="nav-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path v-if="name === 'home'" d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
    <path v-else-if="name === 'mine'" d="M4 20v-6M9.5 20V9M15 20v-8M20.5 20V4" />
    <path v-else-if="name === 'trends'" d="M3 17l6-6 4 4 8-8M15 7h6v6" />
    <template v-else-if="name === 'following'">
      <path d="M3 19h18" />
      <path d="M6 15.5v-3M10 15.5v-5M14 15.5v-2.5" />
      <circle cx="18" cy="6.5" r="2.25" />
      <path d="M18 9.5v6" />
    </template>
    <template v-else-if="name === 'discover'">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </template>
    <template v-else-if="name === 'channels'">
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="M3.5 10h17M10 10v9" />
    </template>
    <path v-else-if="name === 'saved'" d="M6.5 4h11a1 1 0 0 1 1 1v15l-6.5-4.2L5.5 20V5a1 1 0 0 1 1-1z" />
    <template v-else>
      <circle cx="5.5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="18.5" cy="12" r="1.2" fill="currentColor" />
    </template>
  </svg>
</template>
