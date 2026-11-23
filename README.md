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
2. En **SQL Editor**, pega y ejecuta `supabase/schema.sql`.
3. En **Project Settings > API**, copia la URL del proyecto y la clave secreta (`sb_secret_...` o `service_role`).

### 3. Variables de entorno

```bash
cp .env.example .env
```

Llena `NUXT_YOUTUBE_API_KEY`, `NUXT_SUPABASE_URL` y `NUXT_SUPABASE_SECRET_KEY`, y reinicia `npm run dev`.

Las tres claves se usan solo en el servidor; nunca llegan al navegador.

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
| Actualizar un canal | 4 unidades |

La app nunca usa la búsqueda de YouTube, que cuesta 100 unidades por consulta.

## Historial de vistas

Cada actualización guarda una foto de las vistas del día en `video_snapshots`. La interfaz todavía no la muestra;
es la base para la gráfica de crecimiento por video.

## Desplegar en Vercel

1. Sube el proyecto a GitHub e impórtalo en Vercel.
2. Agrega las tres variables de entorno y `NUXT_APP_PASSWORD` con una contraseña larga.
3. Opcional: define `CRON_SECRET` para activar la actualización diaria (`vercel.json`, 9:00 UTC).

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
server/api/          Rutas: outliers, canales, actualización
server/utils/        Cliente de YouTube, Supabase, datos demo
shared/              Cálculo del score y lectura de enlaces de canal
supabase/schema.sql  Tablas
tests/               Tests del cálculo
```
