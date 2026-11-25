<script setup lang="ts">
// Página pública: lo que ve quien llega sin sesión. Google exige que la página principal explique la app
// sin pedir entrar, y que enlace la política de privacidad.
defineProps<{ google: boolean }>()

const preview = [
  { title: 'Configuré OBS como un profesional', channel: 'Taller de Directos', views: '248 mil', normal: '10,5 mil', score: '23,6×', top: true, hue: 28 },
  { title: '7 plugins de OBS que deberías instalar hoy', channel: 'Taller de Directos', views: '64 mil', normal: '10,5 mil', score: '6,1×', top: false, hue: 210 },
  { title: 'Mi setup de streaming completo', channel: 'Taller de Directos', views: '11 mil', normal: '10,5 mil', score: '1,1×', top: false, hue: 150 },
]

const features = [
  {
    title: 'Los outliers de tus canales',
    text: 'Sigue tus canales y los de tu competencia. Ve qué videos se salieron de lo normal y filtra por fecha, formato, duración o categoría.',
  },
  {
    title: 'Tendencias de tus temas',
    text: 'Sigue temas en todo YouTube. Cada día llegan los videos que más rinden en ellos y cuánto impulso tiene cada tema.',
  },
  {
    title: 'Mi canal',
    text: 'Entra con Google y mira de dónde vienen tus vistas, qué buscan para encontrarte y junto a qué videos te recomienda YouTube.',
  },
  {
    title: 'Extensión para Chrome',
    text: 'El score aparece encima de cada miniatura mientras navegas YouTube, con un botón para guardar el video o seguir su canal.',
  },
]
</script>

<template>
  <div class="public">
    <header class="public-nav">
      <a class="brand" href="/">
        <svg class="brand-mark" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
          <rect width="20" height="20" rx="6" fill="#ff6363" />
          <path d="M5 6v8M5 10h7" stroke="#040506" stroke-width="2" stroke-linecap="round" />
          <circle cx="13" cy="10" r="3" fill="#040506" />
        </svg>
        <span>AC Outliers</span>
      </a>
      <nav class="public-links" aria-label="Página">
        <a href="#como">Qué hace</a>
        <a href="/privacidad/">Privacidad</a>
        <a class="button button-small" href="#entrar">Entrar</a>
      </nav>
    </header>

    <section class="public-hero" aria-labelledby="public-title">
      <div class="public-hero-text">
        <h1 id="public-title">Encuentra los videos que superaron por mucho a su propio canal</h1>
        <p class="public-lede">
          AC Outliers compara cada video de YouTube con las vistas habituales de su canal. Un 8× es ocho veces lo
          normal: una idea o una miniatura que funcionó de verdad, sin importar el tamaño del canal.
        </p>
        <p class="public-actions">
          <a v-if="google" class="button button-primary" href="/api/auth/google">Entrar con Google</a>
          <a v-else class="button button-primary" href="#entrar">Entrar</a>
          <a class="link-button" href="#como">Ver qué hace</a>
        </p>
      </div>

      <figure class="public-preview" aria-label="Ejemplo: tres videos de un mismo canal con su score">
        <ol>
          <li v-for="v in preview" :key="v.title" :class="{ 'is-top': v.top }">
            <span class="public-thumb" :style="{ '--hue': v.hue }" aria-hidden="true" />
            <span class="public-row-text">
              <strong>{{ v.title }}</strong>
              <span>{{ v.views }} vistas · lo normal en el canal: {{ v.normal }}</span>
            </span>
            <span class="public-score">{{ v.score }}</span>
          </li>
        </ol>
        <figcaption>Datos de ejemplo de un canal inventado.</figcaption>
      </figure>
    </section>

    <section id="como" class="public-section" aria-labelledby="public-features">
      <h2 id="public-features">Qué puedes hacer</h2>
      <div class="public-features">
        <article v-for="f in features" :key="f.title" class="public-feature">
          <h3>{{ f.title }}</h3>
          <p>{{ f.text }}</p>
        </article>
      </div>
    </section>

    <section class="public-section public-split" aria-labelledby="public-score">
      <div>
        <h2 id="public-score">Cómo se calcula el score</h2>
        <p>
          Se dividen las vistas del video entre la mediana de vistas de los últimos videos de su canal en el mismo formato.
          Los Shorts se comparan solo con Shorts y los videos largos con videos largos.
        </p>
      </div>
      <div>
        <h2>Tus datos</h2>
        <p>
          Solo lectura: AC Outliers no publica, edita ni borra nada en YouTube. Los informes de tu canal se piden a Google
          cuando los abres y no se guardan. Puedes quitar el acceso cuando quieras.
          <a href="/privacidad/">Lee la política de privacidad</a>.
        </p>
      </div>
    </section>

    <section id="entrar" class="public-section public-login" aria-labelledby="public-login-title">
      <h2 id="public-login-title" class="sr-only">Entrar</h2>
      <slot />
    </section>

    <footer class="public-footer">
      <span>AC Outliers es un proyecto de alejoxcode.</span>
      <a href="/privacidad/">Política de privacidad</a>
      <a href="mailto:alejoxcode@gmail.com">alejoxcode@gmail.com</a>
    </footer>
  </div>
</template>
