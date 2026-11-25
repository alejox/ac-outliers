export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',
  devtools: { enabled: false },

  // Solo servidor: estas claves nunca llegan al navegador.
  // Se llenan desde .env con el prefijo NUXT_ (ver .env.example).
  runtimeConfig: {
    youtubeApiKey: '',
    supabaseUrl: '',
    supabaseSecretKey: '',
    appPassword: '',
    // Login con Google (proyecto ac-outliers de Google Cloud). Sin ellas, solo se entra con la contraseña.
    googleClientId: '',
    googleClientSecret: '',
  },

  css: ['~/assets/main.css'],

  app: {
    head: {
      title: 'AC Outliers',
      htmlAttrs: { lang: 'es' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Videos de YouTube que rindieron muy por encima de lo normal en su canal.' },
        { name: 'theme-color', content: '#040506' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap',
        },
      ],
    },
  },
})
