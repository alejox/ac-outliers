<script setup lang="ts">
// Página pública: lo que ve quien llega sin sesión. Google exige que la página principal explique la app
// sin pedir entrar, y que enlace la política de privacidad.
const props = defineProps<{ google: boolean }>()

/** A dónde lleva "Entrar": a Google si está configurado; si no, al formulario con contraseña. */
const enter = computed(() => (props.google ? '/api/auth/google' : '#entrar'))

// Demostración: una página de resultados de YouTube de ejemplo, con y sin el score.
const demo = [
  { score: 1.1, title: 'Mi Stream Deck por 15 dólares', src: '/images/thumbnails/thumb-06.webp', channel: 'Taller de Directos', views: '3,6 mil', duration: '8:40' },
  { score: 13, title: 'Probé un Stream Deck casero durante 30 días', src: '/images/thumbnails/thumb-01.webp', channel: 'Código en Pijama', views: '134,2 mil', duration: '14:08' },
  { score: 0.8, title: 'Stream Deck casero con Arduino, parte 2', src: '/images/thumbnails/thumb-03.webp', channel: 'Byte a Byte', views: '14,5 mil', duration: '18:02' },
  { score: 5.9, title: 'Convertí un teclado viejo en Stream Deck', src: '/images/thumbnails/thumb-02.webp', channel: 'La Terminal de Nico', views: '752,2 mil', duration: '5:18' },
  { score: 1.4, title: 'Los mejores botones para tu directo', src: '/images/thumbnails/thumb-04.webp', channel: 'Pixel Forja', views: '67,1 mil', duration: '11:20' },
  { score: 25, title: '¿Vale la pena un Stream Deck casero?', src: '/images/thumbnails/thumb-08.webp', channel: 'Código en Pijama', views: '255,9 mil', duration: '15:59' },
  { score: 2.3, title: 'Macros en OBS sin gastar nada', src: '/images/thumbnails/thumb-07.webp', channel: 'Taller de Directos', views: '7,6 mil', duration: '9:55' },
  { score: 0.6, title: 'Mi escritorio de streaming 2026', src: '/images/thumbnails/thumb-05.webp', channel: 'Pixel Forja', views: '28,7 mil', duration: '21:07' },
]
const showScore = ref(true)
// Un solo momento al cargar: la página aparece sin score y el score se enciende. Sin movimiento si así se pidió.
onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  showScore.value = false
  setTimeout(() => (showScore.value = true), 700)
})

// Cómo se calcula: los últimos 12 videos de un canal de ejemplo y su mediana.
const bars = [6.2, 9, 7.1, 5.4, 11.5, 7.6, 8.3, 6.8, 14, 7.9, 88, 7.2]

const billing = ref<'month' | 'year'>('month')

const free = [
  '5 canales seguidos',
  '1 tema de tendencias',
  '1 búsqueda en Descubrir al día',
  'Score en YouTube con la extensión de Chrome',
  'Guardar hasta 20 videos',
  'Analizar',
  'Novedades desde tu última visita',
]
const pro = [
  '25 canales seguidos, 5 temas y 5 búsquedas al día',
  'Mi canal: fuentes de tráfico, términos de búsqueda y videos que te recomiendan',
  'Guardados y colecciones sin límite',
  'Historial de cambios de título y miniatura',
  'Todo lo del plan Gratis',
]

const faq = [
  {
    q: '¿Qué es un outlier?',
    a: 'Un video que tuvo muchas más vistas de las que suele tener su canal. Un score de 8× significa ocho veces lo normal de ese canal en ese formato.',
  },
  {
    q: '¿Usa inteligencia artificial?',
    a: 'No. Todo lo que ves son cifras públicas de YouTube y cuentas simples sobre ellas. No genera títulos ni ideas.',
  },
  {
    q: '¿Sirve si mi canal es pequeño?',
    a: 'Sí. El score compara cada video con su propio canal, así que aprendes de canales de cualquier tamaño, y el tuyo no necesita un mínimo de suscriptores.',
  },
  { q: '¿Funciona con Shorts?', a: 'Sí. Los Shorts se comparan solo con los Shorts del canal, y los videos largos con los videos largos.' },
  {
    q: '¿Qué permisos pide al entrar con Google?',
    a: 'Tu nombre y tu correo para crear la cuenta, y leer las estadísticas de tu canal para Mi canal. Nunca pide permiso para publicar o modificar nada.',
  },
  {
    q: '¿Necesito la extensión de Chrome?',
    a: 'No. La app web funciona sola. La extensión pone el score sobre las miniaturas mientras navegas YouTube.',
  },
]
</script>

<template>
  <div class="lp">
    <header class="lp-nav">
      <div class="lp-wrap lp-nav-inner">
        <a class="brand" href="/">
          <BrandMark :size="28" />
          <span>AC Outliers</span>
        </a>
        <nav class="lp-links" aria-label="Página">
          <a href="#como">Cómo funciona</a>
          <a href="#funciones">Funciones</a>
          <a href="#precios">Precios</a>
          <a href="#preguntas">Preguntas</a>
          <a href="/privacidad/">Privacidad</a>
        </nav>
        <a class="button button-primary lp-nav-cta" :href="enter">{{ google ? 'Entrar con Google' : 'Entrar' }}</a>
      </div>
    </header>

    <main>
      <section class="lp-hero" aria-labelledby="public-title">
        <div class="lp-wrap">
          <h1 id="public-title">El video que hizo 13× en tu nicho ya existe. Encuéntralo.</h1>
          <div class="lp-hero-row">
            <p class="lp-lede">
              AC Outliers compara cada video de YouTube con <b>lo normal de su propio canal</b> y te muestra los que se
              dispararon: la idea, el título y la miniatura que sí funcionaron, sin importar el tamaño del canal.
            </p>
            <div class="lp-hero-cta">
              <a class="lp-google" :href="enter">
                <svg v-if="google" viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
                  <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
                  <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
                  <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
                </svg>
                {{ google ? 'Entrar con Google' : 'Entrar' }}
              </a>
              <p class="lp-fine">Gratis para empezar. Solo lectura: no publica ni cambia nada en tu canal.</p>
            </div>
          </div>

          <figure class="lp-demo" :class="{ 'is-on': showScore }" aria-label="Demostración: una página de videos de YouTube con el score de cada uno">
            <div class="lp-demo-bar">
              <p class="lp-demo-query">
                <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                  <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6" />
                  <path d="m13.5 13.5 3.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                </svg>
                stream deck casero
              </p>
              <button class="lp-switch" type="button" role="switch" :aria-checked="showScore" @click="showScore = !showScore">
                <span>Mostrar el score</span>
                <i aria-hidden="true" />
              </button>
            </div>
            <ol class="lp-demo-grid">
              <li v-for="(v, i) in demo" :key="v.title" class="lp-demo-item" :class="{ 'is-low': v.score < 2 }" :style="{ '--i': i }">
                <VideoThumb :src="v.src" :title="v.title" :seed="v.channel" :score="v.score" :duration="v.duration" />
                <p class="lp-demo-title">{{ v.title }}</p>
                <p class="lp-demo-meta">{{ v.channel }} · {{ v.views }} vistas</p>
              </li>
            </ol>
            <figcaption class="lp-demo-note">Datos de ejemplo con canales inventados. Apaga el score: así se ve sin AC Outliers.</figcaption>
          </figure>
        </div>
      </section>

      <section id="como" class="lp-sec" aria-labelledby="como-title">
        <div class="lp-wrap">
          <div class="lp-head">
            <h2 id="como-title">Un número, y sabes de dónde sale</h2>
            <p>El score no es una nota misteriosa. Es una división que puedes revisar en cada video.</p>
          </div>
          <div class="lp-calc">
            <figure class="lp-chart" aria-label="Vistas de los últimos 12 videos de un canal de ejemplo: once rondan las 10 mil y uno llega a 134 mil">
              <div class="lp-bars">
                <i v-for="(b, i) in bars" :key="i" :class="{ 'is-out': b > 50 }" :style="{ height: `${b}%` }" />
                <span class="lp-median"><span>Lo normal del canal: 10,3 mil</span></span>
              </div>
              <figcaption><span>Últimos 12 videos largos de “Código en Pijama”</span><span>Datos de ejemplo</span></figcaption>
            </figure>
            <ol class="lp-steps">
              <li>
                <h3>Miramos los últimos videos del canal</h3>
                <p>Shorts con Shorts y videos largos con videos largos, para comparar lo comparable.</p>
              </li>
              <li>
                <h3>Sacamos su mediana: “lo normal”</h3>
                <p>La mediana no se deja engañar por un video viral aislado. Es lo que ese canal suele conseguir.</p>
              </li>
              <li>
                <h3>Dividimos las vistas del video entre lo normal</h3>
                <p class="lp-eq">134,2 mil <span>÷</span> 10,3 mil <span>=</span> <strong>13×</strong></p>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section id="funciones" class="lp-sec" aria-labelledby="funciones-title">
        <div class="lp-wrap">
          <div class="lp-head">
            <h2 id="funciones-title">De “¿qué subo?” a una lista de ideas que ya funcionaron</h2>
          </div>
          <div class="lp-feats">
            <article class="lp-feat lp-span-7">
              <h3>Los outliers de tus canales</h3>
              <p>Sigue tus canales de referencia y los de tu competencia. Ordena por score y filtra por fecha, formato, duración o categoría.</p>
              <div class="lp-ui lp-ui-grid" aria-hidden="true">
                <div class="lp-ui-chips">
                  <span class="is-on">Videos largos</span><span>Shorts</span><span><em>Score</em> 2× o más</span><span><em>Fecha</em> Cualquiera</span><span><em>Orden</em> Score</span>
                </div>
                <div class="lp-ui-cards">
                  <div><VideoThumb title="7 errores con un plugin de OBS" seed="Pixel Forja" :score="22" /><p>7 errores que cometes con un plugin de OBS</p></div>
                  <div><VideoThumb title="TypeScript sin dolor" seed="Código en Pijama" :score="21" /><p>TypeScript: la guía que me hubiera gustado tener</p></div>
                  <div><VideoThumb title="Multistream sin caídas" seed="Taller de Directos" :score="8.6" /><p>Multistream sin que se caiga el directo</p></div>
                </div>
              </div>
            </article>

            <article class="lp-feat lp-span-5">
              <h3>Analizar: por qué destacó</h3>
              <p>Ritmo, duración, día de publicación y cambios de título o miniatura, comparados con el resto del canal. Solo cifras.</p>
              <div class="lp-ui lp-ui-analyze" aria-hidden="true">
                <div class="lp-ui-big"><strong>13×</strong><p><b>134,2 mil vistas</b> donde lo normal son 10,3 mil</p></div>
                <ScoreStrip :score="13" />
                <p class="lp-ui-find"><span>Ritmo</span>579 vistas por hora, 9 veces más que videos de edad parecida.</p>
                <p class="lp-ui-find"><span>Miniatura</span>El creador la cambió hace 5 días.</p>
              </div>
            </article>

            <article class="lp-feat lp-span-5">
              <h3>Mi canal <span class="lp-tag">Pro</span></h3>
              <p>De dónde vienen tus vistas, qué buscan para encontrarte y junto a qué videos te recomienda YouTube.</p>
              <div class="lp-ui lp-ui-mine" aria-hidden="true">
                <small>Vistas, últimos 28 días</small>
                <strong>184.200</strong>
                <div class="source-stack">
                  <span style="width: 41%; background: #f4f3f1" /><span style="width: 27%; background: #b9b8b5" /><span style="width: 18%; background: #8a8986" /><span style="width: 14%; background: #4a4947" />
                </div>
                <ul>
                  <li><span>Videos sugeridos</span><b>41 %</b></li>
                  <li><span>Búsqueda de YouTube</span><b>27 %</b></li>
                  <li><span>Inicio y suscripciones</span><b>18 %</b></li>
                </ul>
              </div>
            </article>

            <article class="lp-feat lp-span-7">
              <h3>El score mientras navegas YouTube</h3>
              <p>La extensión de Chrome pone el score encima de cada miniatura. Pasa el mouse para ver las cifras, guarda el video o sigue su canal sin salir de la página.</p>
              <div class="lp-ui-ext" aria-hidden="true">
                <div class="lp-ui lp-ui-card">
                  <VideoThumb title="¿Vale la pena Vue 3?" seed="Byte a Byte" :score="10" duration="13:12" />
                  <p>¿Vale la pena Vue 3 en 2026?</p>
                </div>
                <div class="lp-tip">
                  <strong>10×</strong>
                  <dl>
                    <dt>Vistas</dt><dd>189,4 mil</dd>
                    <dt>Lo normal del canal</dt><dd>18,1 mil</dd>
                    <dt>Por hora</dt><dd>62</dd>
                    <dt>Publicado</dt><dd>hace 4 meses</dd>
                  </dl>
                  <p class="lp-tip-actions"><span>Guardar</span><span>Seguir canal</span></p>
                </div>
              </div>
            </article>

            <article class="lp-feat lp-span-12 lp-feat-row">
              <div>
                <h3>Tendencias de tus temas</h3>
                <p>Sigue un tema en todo YouTube. Cada día llegan los videos que más rinden en él y cuánto impulso lleva.</p>
              </div>
              <ul class="lp-ui lp-ui-trends" aria-hidden="true">
                <li><p><b>plugins de OBS</b><small>3 outliers de 17 videos</small></p><p class="lp-n">785<small>por hora</small></p><Sparkline :values="[2, 3, 5, 5, 8, 10, 11, 15, 17, 22, 24, 27]" rising label="" /></li>
                <li><p><b>stream deck casero</b><small>2 outliers de 9 videos</small></p><p class="lp-n">412<small>por hora</small></p><Sparkline :values="[8, 7, 10, 9, 12, 11, 14, 13, 16, 17, 18, 20]" rising label="" /></li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section class="lp-sec" aria-labelledby="quien-title">
        <div class="lp-wrap">
          <div class="lp-head"><h2 id="quien-title">Hecho para quien decide qué se sube</h2></div>
          <figure class="lp-photo">
            <img src="/images/audience/audience-creador.webp" width="1600" height="900" loading="lazy" decoding="async" alt="Un creador en su escritorio con AC Outliers abierto en el monitor">
          </figure>
          <ul class="lp-who">
            <li><img src="/images/audience/audience-canal-pequeno.webp" class="lp-who-img" width="120" height="80" loading="lazy" decoding="async" alt=""><h3>Creadores que planean su próximo video</h3><p>Antes de grabar, mira qué ideas rindieron varias veces lo normal en canales de tu tema.</p></li>
            <li><img src="/images/audience/audience-creador.webp" class="lp-who-img lp-who-img-crop" width="120" height="80" loading="lazy" decoding="async" alt=""><h3>Canales pequeños</h3><p>El score es relativo a cada canal. Un 8× en un canal de 3 mil suscriptores cuenta igual que en uno de 3 millones.</p></li>
            <li><img src="/images/audience/audience-disenador.webp" class="lp-who-img" width="120" height="80" loading="lazy" decoding="async" alt=""><h3>Editores y diseñadores de miniaturas</h3><p>Guarda en colecciones los títulos y miniaturas que despegaron y revisa cuándo un creador los cambió.</p></li>
          </ul>
          <p class="lp-notfor"><b>Para qué no sirve:</b> no genera títulos, guiones ni miniaturas, y no usa IA. Te da cifras claras para que la decisión creativa sea tuya.</p>
        </div>
      </section>

      <section id="precios" class="lp-sec" aria-labelledby="precios-title">
        <div class="lp-wrap">
          <div class="lp-head"><h2 id="precios-title">Empieza gratis. Pasa a Pro cuando te quede corto.</h2></div>
          <div class="segmented lp-bill" role="group" aria-label="Forma de pago">
            <button type="button" :aria-pressed="billing === 'month'" @click="billing = 'month'">Mensual</button>
            <button type="button" :aria-pressed="billing === 'year'" @click="billing = 'year'">Anual</button>
          </div>
          <div class="lp-plans">
            <article class="lp-plan">
              <h3>Gratis</h3>
              <p class="lp-plan-for">Para probar el score con tus canales de referencia.</p>
              <p class="lp-price"><strong>US$0</strong></p>
              <p class="lp-price-note">Sin tarjeta.</p>
              <ul>
                <li v-for="f in free" :key="f">{{ f }}</li>
              </ul>
              <a class="button lp-plan-cta" :href="enter">Empezar gratis</a>
            </article>
            <article class="lp-plan lp-plan-pro">
              <h3>Pro</h3>
              <p class="lp-plan-for">Para investigar un nicho completo y entender tu propio canal.</p>
              <p class="lp-price">
                <strong>{{ billing === 'month' ? 'US$12' : 'US$99' }}</strong>
                <span>{{ billing === 'month' ? 'al mes' : 'al año' }}</span>
              </p>
              <p class="lp-price-note">
                {{ billing === 'month' ? 'O US$99 al año: ahorras US$45.' : 'Equivale a US$8,25 al mes. Ahorras US$45 frente a pagar mes a mes.' }}
              </p>
              <ul>
                <li v-for="(f, i) in pro" :key="f" :class="{ 'is-lead': i === 0 }">{{ f }}</li>
              </ul>
              <span class="button lp-plan-cta is-soon" aria-disabled="true">Próximamente</span>
              <p class="lp-soon-note">Mientras tanto, todas las funciones de Pro están abiertas en el plan Gratis.</p>
            </article>
          </div>
        </div>
      </section>

      <section class="lp-sec" aria-labelledby="datos-title">
        <div class="lp-wrap">
          <div class="lp-trust">
            <h2 id="datos-title">Tus datos y tu canal no se tocan</h2>
            <ul>
              <li><b>Solo lectura</b>AC Outliers no publica, edita ni borra nada en YouTube.</li>
              <li><b>Los informes de tu canal no se guardan</b>Se piden a Google cuando abres Mi canal y se muestran en el momento.</li>
              <li><b>Tú decides</b>Puedes quitar el acceso desde tu cuenta de Google cuando quieras. <a href="/privacidad/">Lee la política de privacidad</a>.</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="preguntas" class="lp-sec" aria-labelledby="preguntas-title">
        <div class="lp-wrap">
          <div class="lp-head"><h2 id="preguntas-title">Preguntas frecuentes</h2></div>
          <div class="lp-faq">
            <details v-for="(f, i) in faq" :key="f.q" :open="i === 0">
              <summary>{{ f.q }}</summary>
              <p>{{ f.a }}</p>
            </details>
          </div>
        </div>
      </section>

      <section id="entrar" class="lp-wrap" aria-labelledby="entrar-title">
        <div class="lp-close">
          <h2 id="entrar-title">Tu próximo video puede empezar con una pista real</h2>
          <p>Sigue cinco canales de tu tema y mira hoy cuáles de sus videos se dispararon.</p>
          <slot />
          <p class="lp-fine">Gratis para empezar. Sin tarjeta.</p>
        </div>
      </section>
    </main>

    <footer class="lp-footer">
      <div class="lp-wrap lp-footer-inner">
        <a class="brand" href="/"><BrandMark :size="22" /><span>AC Outliers</span></a>
        <span>Un proyecto de alejoxcode</span>
        <a href="/privacidad/">Política de privacidad</a>
        <a href="mailto:alejoxcode@gmail.com">alejoxcode@gmail.com</a>
      </div>
    </footer>
  </div>
</template>
