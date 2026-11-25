<script setup lang="ts">
import {
  defaultFilters,
  DURATION_OPTIONS,
  SIZE_OPTIONS,
  VIEWS_OPTIONS,
  extraFilterCount,
  type FilterState,
  type Format,
} from '~~/shared/filters'

const filters = defineModel<FilterState>({ required: true })
const view = defineModel<'list' | 'grid'>('view', { required: true })

const props = defineProps<{
  /** Categorías que existen entre los videos que se están filtrando. */
  categories: { id: string; name: string }[]
  showFormat?: boolean
  showPeriod?: boolean
  /** Valores de partida de esta sección: un filtro que se aparta de ellos se marca como activo. */
  defaults?: FilterState
}>()

const base = computed(() => props.defaults ?? defaultFilters())
const changed = (key: keyof FilterState) => filters.value[key] !== base.value[key]

const open = ref(false)
const extra = computed(() => extraFilterCount(filters.value))

const FORMATS: { value: Format; label: string }[] = [
  { value: 'long', label: 'Videos largos' },
  { value: 'short', label: 'Shorts' },
  { value: 'all', label: 'Todo' },
]

function clearExtra() {
  Object.assign(filters.value, { channelSize: 'any', minViews: 0, duration: 'any', category: '' })
}
</script>

<template>
  <div class="filters" :class="{ 'is-open': open }">
    <div v-if="showFormat" class="filter-group" role="group" aria-label="Formato">
      <button
        v-for="option in FORMATS"
        :key="option.value"
        class="chip-toggle"
        type="button"
        :aria-pressed="filters.format === option.value"
        @click="filters.format = option.value"
      >
        {{ option.label }}
      </button>
    </div>
    <span v-if="showFormat" class="filters-sep" aria-hidden="true" />

    <label v-if="showPeriod" class="tool tool-select" :class="{ 'is-active': changed('periodDays') }">
      <span class="tool-label" aria-hidden="true">Fecha</span>
      <select v-model.number="filters.periodDays" aria-label="Publicados en">
        <option :value="7">7 días</option>
        <option :value="30">30 días</option>
        <option :value="90">90 días</option>
        <option :value="365">1 año</option>
        <option :value="0">Cualquier fecha</option>
      </select>
    </label>

    <label class="tool tool-select" :class="{ 'is-active': changed('minScore') }">
      <span class="tool-label" aria-hidden="true">Score</span>
      <select v-model.number="filters.minScore" aria-label="Score mínimo">
        <option :value="0">Sin mínimo</option>
        <option :value="1.5">1,5× o más</option>
        <option :value="2">2× o más</option>
        <option :value="3">3× o más</option>
        <option :value="5">5× o más</option>
        <option :value="10">10× o más</option>
      </select>
    </label>

    <label class="tool tool-select" :class="{ 'is-active': changed('sort') }">
      <span class="tool-label" aria-hidden="true">Orden</span>
      <select v-model="filters.sort" aria-label="Ordenar por">
        <option value="score">Score</option>
        <option value="pace">Vistas por hora</option>
        <option value="views">Vistas totales</option>
        <option value="engagement">Interacción</option>
        <option value="recent">Más recientes</option>
      </select>
    </label>

    <label class="tool tool-search" :class="{ 'is-active': filters.title.trim() !== '' }">
      <span class="sr-only">Buscar en títulos</span>
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M2.75 4.25h10.5M4.75 8h6.5M6.75 11.75h2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      <input v-model="filters.title" type="search" placeholder="Filtrar por título" autocomplete="off" />
    </label>

    <button class="chip-toggle more-filters" type="button" :aria-expanded="open" @click="open = !open">
      {{ open ? 'Menos filtros' : 'Más filtros' }}<span v-if="extra > 0" class="count">{{ extra }}</span>
    </button>

    <ViewSwitch v-model="view" />
  </div>

  <div v-if="open" class="filters filters-extra">
    <label class="tool tool-select" :class="{ 'is-active': filters.channelSize !== 'any' }">
      <span class="tool-label" aria-hidden="true">Tamaño del canal</span>
      <select v-model="filters.channelSize" aria-label="Tamaño del canal">
        <option v-for="o in SIZE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </label>

    <label class="tool tool-select" :class="{ 'is-active': filters.minViews > 0 }">
      <span class="tool-label" aria-hidden="true">Vistas mínimas</span>
      <select v-model.number="filters.minViews" aria-label="Vistas mínimas">
        <option v-for="o in VIEWS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </label>

    <label class="tool tool-select" :class="{ 'is-active': filters.duration !== 'any' }">
      <span class="tool-label" aria-hidden="true">Duración</span>
      <select v-model="filters.duration" aria-label="Duración">
        <option v-for="o in DURATION_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </label>

    <label class="tool tool-select" :class="{ 'is-active': filters.category !== '' }">
      <span class="tool-label" aria-hidden="true">Categoría</span>
      <select v-model="filters.category" aria-label="Categoría" :disabled="categories.length === 0">
        <option value="">{{ categories.length === 0 ? 'Sin datos todavía' : 'Todas' }}</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
    </label>

    <button v-if="extra > 0" class="button button-ghost button-small clear-filters" type="button" @click="clearExtra">Quitar estos filtros</button>
  </div>
</template>
