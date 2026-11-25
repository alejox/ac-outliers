# Ficha de Chrome Web Store

Textos para pegar en el panel del desarrollador. Si cambia lo que hace la extensión, actualízalos aquí.

## Ficha de Play Store → Detalles del producto

**Nombre:** AC Outliers (lo toma del manifiesto)

**Resumen (máx. 132 caracteres):**
Mira cuántas veces cada video de YouTube superó las vistas normales de su canal, directo en las miniaturas.

**Descripción:**

AC Outliers te muestra qué videos de YouTube rindieron muy por encima de lo normal en su propio canal, mientras navegas.

Encima de cada miniatura aparece su score: las vistas del video divididas por las vistas normales de su canal. Un 5× significa que tuvo cinco veces lo que suele tener ese canal. Así encuentras ideas y miniaturas que funcionaron de verdad, no solo videos de canales grandes.

Qué hace:
• Score en cada miniatura de Inicio, búsquedas, recomendados y Shorts. Desde 10× se marca en rojo.
• Al pasar el mouse: vistas, lo normal del canal, vistas por hora y hace cuánto se publicó.
• Bajo el título del video que ves: el score con sus cifras, y botones para guardarlo, seguir su canal y ver o copiar sus etiquetas.
• Los Shorts se comparan solo con los Shorts del canal, y los videos largos con los videos largos.
• Los videos recién publicados aparecen como "Nuevo" hasta que tengan tiempo de compararse.
• Filtra desde el panel: todos, 2×, 5× o 10×.

Funciona conectada a tu app AC Outliers, donde sigues canales y temas, ves tendencias y guardas los videos.

Privacidad: la extensión solo lee los IDs de los videos que aparecen en YouTube. No lee tu historial, tus búsquedas ni tu cuenta.

**Categoría:** Productividad → Herramientas
**Idioma:** Español

## Recursos gráficos

- Icono de la tienda (128×128): `extension/icons/icon128.png`
- Capturas (1280×800): `captura-1-inicio.png`, `captura-2-video.png`, `captura-3-panel.png`
- Mosaico promocional pequeño (440×280): `mosaico-440x280.png`

## Prácticas de privacidad

**Propósito único:**
Mostrar en YouTube cuántas veces cada video superó las vistas normales de su canal, y guardar videos o seguir canales en la app AC Outliers del usuario.

**Justificación de permisos:**
- `storage`: guarda la dirección de la app del usuario, su código de conexión, sus ajustes y, por unas horas, los puntajes ya consultados para no repetir peticiones.
- Acceso a `https://www.youtube.com/*` (script de contenido): lee los IDs de los videos de la página para poner el score sobre cada miniatura y bajo el título.

**¿Usas código remoto?** No. Todo el código va en el paquete; la extensión solo recibe datos (puntajes) en JSON.

**Datos que se recopilan (marcar):**
- Información de autenticación: la contraseña de la app se envía una vez a la app del usuario para obtener el código de conexión.
- Contenido del sitio web: IDs de los videos que aparecen en YouTube.

**Certificaciones (marcar las tres):**
- No vendo ni transfiero datos de usuarios a terceros, fuera de los casos de uso aprobados.
- No uso ni transfiero datos de usuarios para fines no relacionados con el propósito único del elemento.
- No uso ni transfiero datos de usuarios para determinar la solvencia crediticia o para préstamos.

**URL de la política de privacidad:** https://ac-outliers.vercel.app/privacidad/

## Distribución

**Visibilidad:** No listado (solo quien tenga el enlace), hasta que existan las cuentas con Google (fase 3).
**Regiones:** Todas.
