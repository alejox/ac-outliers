// Genera los íconos de la marca a partir de un solo origen: shared/brand.ts.
// Uso: node scripts/brand-icons.mjs [--extension]
//   Sin opciones: public/favicon.svg, public/favicon-32.png, public/favicon.ico y public/apple-touch-icon.png.
//   --extension: además extension/icons/icon16|32|48|128.png (solo cuando se elija el símbolo de la extensión).
// Los PNG se dibujan con Chrome sin ventana (CHROME=/ruta/a/chrome si no está en /usr/bin/google-chrome).
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BRAND, brandSvg } from '../shared/brand.ts'

const root = new URL('..', import.meta.url).pathname
const chrome = process.env.CHROME ?? '/usr/bin/google-chrome'
const work = mkdtempSync(join(tmpdir(), 'marca-'))

/** El símbolo a `size` px, con `pad` de margen y fondo opcional (el ícono de iPhone no admite transparencia). */
function png(size, out, { pad = 0, background = null } = {}) {
  const inner = size - pad * 2
  const html = `<!doctype html><html><body style="margin:0;background:${background ?? 'transparent'}">
<div style="width:${size}px;height:${size}px;display:grid;place-items:center">${brandSvg(inner)}</div></body></html>`
  const page = join(work, `${size}.html`)
  writeFileSync(page, html)
  execFileSync(chrome, ['--headless', '--no-sandbox', '--hide-scrollbars', '--default-background-color=00000000',
    `--window-size=${size},${size}`, `--screenshot=${out}`, `file://${page}`], { stdio: 'ignore' })
  return readFileSync(out)
}

/** Un .ico con imágenes PNG dentro (lo aceptan todos los navegadores actuales). */
function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, data }, i) => {
    const e = 6 + i * 16
    header.writeUInt8(size >= 256 ? 0 : size, e)
    header.writeUInt8(size >= 256 ? 0 : size, e + 1)
    header.writeUInt16LE(1, e + 4)
    header.writeUInt16LE(32, e + 6)
    header.writeUInt32LE(data.length, e + 8)
    header.writeUInt32LE(offset, e + 12)
    offset += data.length
  })
  return Buffer.concat([header, ...images.map((i) => i.data)])
}

writeFileSync(join(root, 'public/favicon.svg'), brandSvg().replace(/ width="\d+" height="\d+"/, ''))
png(32, join(root, 'public/favicon-32.png'))
png(180, join(root, 'public/apple-touch-icon.png'), { pad: 20, background: BRAND.base })
const sizes = [16, 32, 48]
writeFileSync(join(root, 'public/favicon.ico'), ico(sizes.map((size) => ({ size, data: png(size, join(work, `ico-${size}.png`)) }))))

if (process.argv.includes('--extension')) {
  for (const size of [16, 32, 48, 128]) png(size, join(root, `extension/icons/icon${size}.png`))
}
console.log('Íconos generados desde shared/brand.ts' + (process.argv.includes('--extension') ? ' (con los de la extensión)' : ''))
