# AC Outliers

Encuentra los videos de YouTube que rindieron muy por encima de lo normal en su propio canal.

**Outlier score** = vistas del video ÷ mediana de vistas de los últimos videos de ese canal, en el mismo formato.
Un 5× significa que el video tuvo cinco veces las vistas habituales de ese canal.

Hecho con Nuxt 4 y Supabase.

## Probarla en modo demo

Sin configurar nada, la app arranca con canales inventados:

```bash
npm install
npm run dev
```

Abre http://localhost:3000.

## Usarla con canales reales

### 1. Clave de YouTube

1. Entra a [Google Cloud Console](https://console.cloud.google.com/) y crea un proyecto.
2. En **APIs y servicios > Biblioteca**, habilita **YouTube Data API v3**.
3. En **Credenciales**, crea una **clave de API**. Restríngela a YouTube Data API v3.

### 2. Base de datos en Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com/).
2. En **SQL Editor**, pega y ejecuta, en orden, los archivos de `supabase/migrations/`. Si configuras las
   [migraciones automáticas](#migraciones-automáticas), este paso lo hace GitHub por ti.
3. En **Project Settings > API**, copia la URL del proyecto y la clave secreta (`sb_secret_...` o `service_role`).

### 3. Variables de entorno

```bash
cp .env.example .env
```

Llena `NUXT_YOUTUBE_API_KEY`, `NUXT_SUPABASE_URL` y `NUXT_SUPABASE_SECRET_KEY`, y reinicia `npm run dev`.

Las tres claves se usan solo en el servidor; nunca llegan al navegador.

## Qué puedes hacer

Tomando como referencia las herramientas Outliers, Most Viewed y Competitors de vidIQ:

- **Inicio** (la pantalla de entrada): lo que pasó en tus canales y tus temas, en bloques que solo
  aparecen si tienen datos (ver [Inicio](#inicio)). Arriba van las **novedades desde tu última visita**: los
  outliers (2× o más) de tus canales y tus temas que no estaban la vez anterior. Se recuerdan en el navegador,
  sin gastar cuota; la primera visita solo toma nota.
- **Tendencias**: sigues hasta 8 temas, con palabra clave, categoría o ambas, y la
  app guarda los outliers de cada uno entre lo publicado en los últimos 30 días. Se refrescan una vez al
  día, así que abrir la pestaña no gasta cuota. Sin temas, muestra lo que más rápido sube en tus canales.
- **Tus canales**: ranking de los videos de los canales que sigues. Filtra por formato, fecha, score,
  palabras del título, tamaño del canal, vistas mínimas, duración y categoría de YouTube. Ordena por
  score, vistas por hora, vistas totales, interacción o fecha. Nada de esto gasta cuota.
- **Vista de miniaturas**: la misma lista como cuadrícula, para estudiar el empaque de los outliers.
- **Palabras que se repiten**: las que más aparecen en los títulos de los outliers en pantalla.
- **Descubrir**: busca videos largos en todo YouTube por tema, por categoría o por ambos; prefiere
  resultados en español y puede traer los más relevantes o los más vistos. Los puntúa contra lo normal
  de su canal y te deja seguir el canal desde el resultado. No se guardan: repetir una búsqueda vuelve
  a gastar cuota.
- **Es mi canal**: en "Tus canales", el icono de persona de cada canal lo marca como tuyo (puedes marcar
  varios). Tus canales llevan la insignia "Tuyo" y activan "Tus logros" en Inicio.
- **Analizar**: cada video en lista tiene el botón "Analizar", que abre un panel con por qué destaca frente
  a los demás videos guardados de su canal en el mismo formato (ver [Analizar](#analizar)).
- **Guardados**: cada video en lista tiene "Guardar"; también se guarda desde YouTube con la extensión. Se
  guarda la foto del video con su score de ese día, así que verlos no gasta cuota. Se agrupan en
  **colecciones**: cada video va en una o en ninguna, y eliminar una colección no borra sus videos.
- **Cambios de título y miniatura**: en cada actualización la app compara el título y la miniatura de los
  videos de tus canales con los de la vez anterior (las miniaturas, solo de videos de los últimos 60 días).
  Un video que cambió lo dice en su fila, y "Analizar" muestra el título o la miniatura de antes y de ahora.
  Las miniaturas se bajan de i.ytimg.com, así que no gastan cuota.
- **Comparar canales**: una fila por canal con suscriptores, vistas normales, alcance (vistas normales
  ÷ suscriptores), subidas en 30 días, cuántos videos llegaron a 2× en 90 días y su mejor video.

### Métricas

| Métrica | Qué es |
| --- | --- |
| Score | Vistas ÷ vistas normales del canal en ese formato |
| Vistas por hora | Ritmo desde la actualización anterior. Sin historial todavía, el promedio desde que se publicó |
| Interacción | (Likes + comentarios) ÷ vistas |

Las vistas por hora recientes aparecen a partir del segundo día de datos de cada video; por eso conviene
dejar activa la actualización diaria.

## Inicio

Lee solo lo guardado: abrirlo no gasta cuota. Los bloques van en este orden y se omiten si no tienen datos.

1. **Éxitos recientes**: videos de tus canales publicados en los últimos 14 días con score de 2× o más,
   del más nuevo al más antiguo (máximo 6).
2. **Impulso de tus temas**: una fila por tema con su impulso de hoy, el cambio frente a 7 días antes y una
   línea de los últimos 14 días. Con menos de dos días de datos solo se ve la cifra actual.
3. **Competidores sugeridos**: canales que aparecen en los resultados de tus temas y que no sigues, ordenados
   por cuántos videos largos de 2× o más tienen ahí y luego por su mejor score (máximo 8). Si marcaste un
   canal como tuyo, van primero los que tienen entre 0,2× y 5× los suscriptores de tu canal más grande.
4. **Tus logros**: uno por cada canal tuyo (ver abajo).

### Impulso de un tema

**Impulso** = suma de las vistas por hora de los videos largos del tema con score de 2× o más, entre los
resultados guardados en cada actualización. Las vistas por hora son las del momento de la búsqueda
(vistas ÷ horas desde la publicación). Mide cuánta atención están atrayendo ahora los outliers del tema:
sube si aparecen más outliers o si los que hay van más rápido.

Cada vez que un tema se refresca se guarda una foto del día en `topic_snapshots` (impulso, outliers y total
de videos; la última actualización del día reemplaza a la anterior). El cambio compara el último día con el
de 7 días antes; si todavía no hay tantos días, con el más antiguo, y lo dice ("en 2 días"). La lógica está
en `shared/home.ts`.

### Tus logros

Calculados en `shared/achievements.ts`:

- **Suscriptores**: 100, 500, 1 mil, 5 mil, 10 mil, 50 mil, 100 mil, 500 mil y 1 millón.
- **Vistas del canal**: 1 mil, 10 mil, 100 mil, 1 millón y 10 millones.
- **Videos**: primer video largo a 2×, 5× y 10×; récord de score; video más visto; primer video con
  1 mil, 10 mil y 100 mil vistas.
- **Constancia**: semanas seguidas (de lunes a domingo, UTC) con al menos una subida, y videos publicados.

La fecha de un hito de suscriptores o vistas es la de la primera foto diaria (`channel_snapshots`) en que la
cifra lo superó. Si ya lo superaba en la primera foto guardada, se lee "Ya alcanzado", sin fecha. La siguiente
meta de cada escalera muestra cuánto falta.

Límites: los logros de videos salen de los videos guardados, que son los últimos 50 largos y 50 Shorts de cada
canal; un video más antiguo no cuenta, así que "primer video a 2×" significa el primero entre esos. Las fechas
de suscriptores y vistas solo existen desde que la app empezó a guardar fotos del canal.

## Entrar con Google y Mi canal

Además de la contraseña, se puede entrar con una cuenta de Google. Al entrar, la app detecta el canal de YouTube de
esa cuenta, lo sigue y lo marca como tuyo, y habilita **Mi canal**: vistas, horas vistas, duración media, suscriptores,
de dónde vienen las vistas, los términos de búsqueda que te encuentran y los videos junto a los que YouTube te sugiere.
Usa YouTube Analytics, que no gasta la cuota de la YouTube Data API.

Configuración (proyecto `ac-outliers` de Google Cloud):

1. Habilita **YouTube Data API v3** y **YouTube Analytics API**.
2. En la pantalla de consentimiento: página principal `https://acoutliers.alejoxcode.com`, política
   `https://acoutliers.alejoxcode.com/privacidad/`, dominio autorizado `alejoxcode.com`, y los permisos `openid`,
   `email`, `profile`, `youtube.readonly` y `yt-analytics.readonly`.
3. Crea un cliente OAuth de tipo **Aplicación web** con el URI de redirección `https://acoutliers.alejoxcode.com/api/auth/callback`
   (y `http://localhost:3000/api/auth/callback` para desarrollo).
4. En Vercel, define `NUXT_GOOGLE_CLIENT_ID` y `NUXT_GOOGLE_CLIENT_SECRET`.

Mientras la app esté **en prueba** en Google, solo entran las cuentas agregadas como usuarios de prueba. Por ahora todas
las cuentas que entran ven los mismos canales y temas: **no publiques la app en Google antes de separar los datos por
usuario**. El permiso de Google se guarda cifrado con una clave derivada de `NUXT_GOOGLE_CLIENT_SECRET`; si cambias el
secreto, hay que volver a entrar.

## Extensión del navegador

La carpeta `extension/` es una extensión de Chrome (también sirve en Edge, Brave y Opera) que muestra el score
de cada video mientras navegas YouTube:

- **Encima de cada miniatura**: en Inicio, búsquedas, recomendados, la barra lateral y los Shorts. Desde 10×
  el número sale en coral.
- **Bajo el título del video que estás viendo**: el score, sus vistas y las vistas normales del canal, con
  botones para **guardar** el video, **seguir** su canal y ver o copiar sus **etiquetas**.

Los Shorts se comparan con los Shorts del canal y los videos largos con sus videos largos, igual que en la app.

### Instalarla

1. Abre `chrome://extensions` y activa el **Modo de desarrollador** (arriba a la derecha).
2. Pulsa **Cargar descomprimida** y elige la carpeta `extension/`.
3. Fija el icono de AC Outliers en la barra y ábrelo.
4. Escribe la dirección de tu app (viene puesta `https://acoutliers.alejoxcode.com`) y la misma contraseña con
   la que entras a la web. Pulsa **Conectar**.

Desde el mismo panel la apagas, eliges desde qué score mostrar (todos, 2×, 5× o 10×) y ves cuánta cuota gastó hoy.

### Cómo funciona

La extensión nunca habla con YouTube: le manda a tu app los IDs de los videos que hay en pantalla y la app
responde con el score. La clave de YouTube sigue solo en el servidor.

- Lo normal de cada canal se guarda un día en `channel_baselines`, para que ver la misma página otra vez, o
  videos del mismo canal, no gaste cuota. Los canales que sigues se calculan con lo que ya está guardado.
- Cada puntaje se guarda 6 horas dentro del navegador.
- Cambiar la contraseña de la app desconecta la extensión: hay que volver a conectarla.
- Las rutas `/api/ext/*` aceptan peticiones solo desde extensiones del navegador.

## Analizar

El panel compara el video con los demás videos guardados del mismo canal y formato, sin IA
(`shared/analysis.ts`): vistas frente a lo normal, vistas por hora frente a la mediana del canal, duración,
día y hora de publicación frente al día en que más publica el canal, largo del título, palabras que comparte
con los otros outliers (2× o más) del canal y la interacción si los likes son públicos. Con menos de 5 videos
comparables no saca conclusiones. No gasta cuota: para Descubrir usa los videos que la búsqueda ya leyó, y para
Tendencias los que se guardaron con el tema (columna `topics.context`).

### Lo que no hace

- Tendencias generales por categoría: YouTube retiró esa lista en 2025 y su API solo entrega música, cine y videojuegos.
- Volumen de búsqueda de palabras clave: la API no lo da.
- Ideas con IA y alertas: quedan para después.

## Cómo se calcula

- Se traen los últimos 50 videos largos y los últimos 50 Shorts de cada canal. Los directos quedan fuera.
- Shorts y videos largos se comparan por separado: cada formato tiene su propia mediana.
- Los videos con menos de 2 días no entran en la mediana (siguen acumulando vistas), pero sí reciben score.
- Un canal necesita al menos 5 videos de un formato para tener score en ese formato.
- **Vistas por día** sirve para detectar videos nuevos que van rápido aunque su score todavía sea bajo.

La lógica vive en `shared/outliers.ts`, sin dependencias, para reutilizarla en la extensión de Chrome.

## Cuota de la API

La cuota gratuita es de 10.000 unidades diarias.

| Acción | Costo aproximado |
| --- | --- |
| Agregar un canal | 5 unidades |
| Actualizar un canal | 5 unidades |
| Descubrir | 100 de la búsqueda + 2 por cada canal encontrado (unas 150) |
| Refrescar un tema de Tendencias | Lo mismo que una búsqueda (unas 150), una vez al día |
| Guardar un video | 0 si es de un canal que sigues; si no, de 2 a 4 |
| Extensión: abrir un video (etiquetas) | 1, una vez cada 6 horas por video |
| Extensión: una página de YouTube | 1 por los videos + 2 por cada canal nuevo del día (una página de Inicio con canales nunca vistos, unas 50) |

Con la cuota gratuita alcanzan unas 60 búsquedas al día. Ocho temas gastan unas 1.200 unidades diarias.
La extensión gasta sobre todo con canales que no ha visto ese día; volver a páginas ya vistas casi no cuesta.

## Historial

Cada actualización guarda una foto del día: las vistas de cada video (`video_snapshots`) y las cifras de
cada canal (`channel_snapshots`). `video_changes` guarda los cambios de título y miniatura. Con la primera se calculan las vistas por hora recientes; la segunda es
la base para fechar los logros de tus canales en Inicio. `topic_snapshots` guarda el impulso diario de cada tema.

## Migraciones automáticas

Los cambios de base de datos viven en `supabase/migrations/`. El flujo
`.github/workflows/supabase-migraciones.yml` aplica los archivos nuevos cada vez que se sube un cambio
de esa carpeta a `main`, así nadie tiene que pegar SQL a mano.

Para activarlo, una sola vez:

1. En Supabase, abre **Connect** y copia la cadena de conexión **Session pooler** (formato URI).
   Reemplaza `[YOUR-PASSWORD]` por la contraseña de la base de datos. Si la contraseña tiene símbolos
   como `@`, `#` o `/`, cámbiala por una solo con letras y números (Database > Settings) para no tener
   que codificarla.
2. En GitHub, ve a **Settings > Secrets and variables > Actions > New repository secret**.
   Nombre: `SUPABASE_DB_URL`. Valor: la cadena completa.
3. En la pestaña **Actions**, abre "Migraciones de Supabase" y pulsa **Run workflow** para aplicar lo pendiente.

Esa cadena da acceso total a la base de datos: solo va en el secreto de GitHub, nunca en el código ni en chats.

## Desplegar en Vercel

1. Sube el proyecto a GitHub e impórtalo en Vercel.
2. Agrega las tres variables de entorno y `NUXT_APP_PASSWORD` con una contraseña larga.
3. Define `CRON_SECRET` para activar la actualización diaria de canales y temas (`vercel.json`, 9:00 UTC).
   Sin ella, todo se actualiza solo cuando pulsas "Actualizar datos".

**Contraseña**: con `NUXT_APP_PASSWORD` definida, la app pide esa contraseña antes de mostrar o cambiar nada.
Sin ella, cualquiera con el enlace puede agregar canales y gastar tu cuota. Es una sola contraseña compartida,
no cuentas de usuario; el login con Supabase Auth es el siguiente paso para abrirla a más gente.

## Tests

```bash
npm test
```

## Estructura

```
app/                 Interfaz (Vue)
extension/           Extensión de Chrome (se carga tal cual, sin compilar)
server/api/          Rutas: outliers, canales, búsqueda, actualización
server/utils/        Cliente de YouTube, Supabase, datos demo
shared/              Score, filtros, categorías, resumen por canal, Inicio, logros y análisis (lógica pura)
supabase/migrations  Cambios de la base de datos, en orden
tests/               Tests del cálculo
```
