// La marca en un solo lugar: el símbolo (para la app, el favicon y los íconos) y sus colores.
// Para cambiar de logo se cambia este archivo y se vuelven a generar los íconos con scripts/brand-icons.mjs.

export const BRAND = {
  name: 'AC Outliers',
  coral: '#ff6363',
  ink: '#1c0b0b',
  base: '#0e0e0f',
} as const

/** Símbolo A ("la regla"): cuadrado coral con la línea de lo normal y un punto que se dispara. Cuerpo SVG sin la etiqueta <svg>. */
export const BRAND_MARK = {
  viewBox: '0 0 32 32',
  body:
    `<rect width="32" height="32" rx="9" fill="${BRAND.coral}"/>` +
    `<path d="M8 17.5v9" stroke="${BRAND.ink}" stroke-width="2.8" stroke-linecap="round"/>` +
    `<path d="M8 22h7.5l5-7.5" fill="none" stroke="${BRAND.ink}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="23" cy="10.5" r="4" fill="${BRAND.ink}"/>`,
} as const

/** El símbolo como archivo SVG completo (favicon y fuente de los PNG). */
export const brandSvg = (size = 20) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BRAND_MARK.viewBox}" width="${size}" height="${size}">${BRAND_MARK.body}</svg>\n`
