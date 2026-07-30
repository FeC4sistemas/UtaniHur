/*
  Baixa as imagens de outfits/mounts das páginas da wiki do RubinOT.

  Uso:
    npm run wiki:outfits
    npm run wiki:mounts
  (ou: ts-node src/scripts/scrapWiki.ts outfits [url])

  Salva em apps/web/public/sprites/wiki/{outfits|mounts}/{Nome}.{gif|png}
  e grava output/wikiSample.json com uma amostra {nome, src} para conferência.
  O seletor de filtro usa essas imagens como fallback.
*/
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import fs from 'fs'
import path from 'path'

puppeteer.use(StealthPlugin())

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const KIND = (process.argv[2] === 'mounts' ? 'mounts' : 'outfits') as 'outfits' | 'mounts'
const DEFAULT_URL =
  KIND === 'mounts' ? 'https://wiki.rubinot.com/pt-BR/montarias' : 'https://wiki.rubinot.com/pt-BR/outfits'
const URL = process.argv[3] || DEFAULT_URL

const OUT_DIR = path.resolve(__dirname, `../../../web/public/sprites/wiki/${KIND}`)
const SAMPLE = path.resolve(__dirname, `../../output/wikiSample-${KIND}.json`)

/** Nome de arquivo seguro, mantendo o nome legível. */
function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '').trim()
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  console.log(`🚀 Abrindo ${URL} ...`)
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: puppeteer.executablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null,
  })
  const page = await browser.newPage()
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 })
  await sleep(6000)
  // rola até o fim para carregar imagens lazy
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 800) {
      window.scrollTo(0, y)
      await new Promise(r => setTimeout(r, 120))
    }
  })
  await sleep(1500)

  // Extrai pares {nome, src}: imagem + nome (alt/title/legenda/célula vizinha)
  const entries: Array<{ name: string; src: string }> = await page.evaluate(() => {
    const out: Array<{ name: string; src: string }> = []
    const seen = new Set<string>()
    document.querySelectorAll<HTMLImageElement>('img').forEach(img => {
      const src = img.currentSrc || img.src
      if (!src || src.startsWith('data:')) return
      // ignora ícones/logos pequenos
      if ((img.naturalWidth && img.naturalWidth < 24) || /logo|icon|sprite-sheet|flag/i.test(src)) return
      // nome: alt/title, senão legenda/figcaption, senão texto do container/célula
      let name =
        (img.getAttribute('alt') || img.getAttribute('title') || '').trim()
      if (!name) {
        const fig = img.closest('figure')?.querySelector('figcaption')?.textContent
        const cell = img.closest('td, li, .gallerybox, [class*="card"]')?.textContent
        name = (fig || cell || '').trim()
      }
      name = name.replace(/\s+/g, ' ').slice(0, 40).trim()
      if (!name) return
      const key = name.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      out.push({ name, src })
    })
    return out
  })

  fs.writeFileSync(SAMPLE, JSON.stringify({ url: URL, count: entries.length, sample: entries.slice(0, 40) }, null, 2))
  console.log(`🔎 ${entries.length} imagens encontradas (amostra em output/wikiSample-${KIND}.json)`)

  const download = (src: string) =>
    page.evaluate(async (u: string) => {
      try {
        const res = await fetch(u)
        if (!res.ok) return null
        const type = res.headers.get('content-type') || ''
        const bytes = new Uint8Array(await res.arrayBuffer())
        let bin = ''
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
        return { b64: btoa(bin), type }
      } catch {
        return null
      }
    }, src)

  let ok = 0
  for (const e of entries) {
    const file = await download(e.src)
    if (file) {
      const ext = file.type.includes('png') ? 'png' : 'gif'
      fs.writeFileSync(path.join(OUT_DIR, `${safeName(e.name)}.${ext}`), Buffer.from(file.b64, 'base64'))
      ok++
    }
    if (ok % 20 === 0) process.stdout.write(`\r⬇️  ${ok}/${entries.length}`)
    await sleep(120)
  }
  console.log(`\n✅ ${ok} imagens salvas em ${path.relative(process.cwd(), OUT_DIR)}`)
  console.log('   Se os nomes não baterem com o filtro, me mande output/wikiSample-*.json que eu ajusto.')

  await browser.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
