// La marca en un solo lugar: el símbolo (para la app, el favicon y los íconos) y sus colores.
// Para cambiar de logo se cambia este archivo y se vuelven a generar los íconos con scripts/brand-icons.mjs.

export const BRAND = {
  name: 'AC Outliers',
  coral: '#ff6363',
  ink: '#1c0b0b',
  base: '#0e0e0f',
} as const

/** Símbolo actual: cuadrado coral redondeado con una "h" y un punto. Cuerpo SVG sin la etiqueta <svg>. */
export const BRAND_MARK = {
  viewBox: '0 0 20 20',
  body:
    `<rect width="20" height="20" rx="6" fill="${BRAND.coral}"/>` +
    `<path d="M5 6v8M5 10h7" stroke="${BRAND.ink}" stroke-width="2" stroke-linecap="round" fill="none"/>` +
    `<circle cx="13" cy="10" r="3" fill="${BRAND.ink}"/>`,
} as const

/** El símbolo como archivo SVG completo (favicon y fuente de los PNG). */
export const brandSvg = (size = 20) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BRAND_MARK.viewBox}" width="${size}" height="${size}">${BRAND_MARK.body}</svg>\n`
