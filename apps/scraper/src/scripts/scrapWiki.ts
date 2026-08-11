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
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null,
  })
  const page = await browser.newPage()

  // Captura toda imagem carregada pela rede (fonte definitiva)
  const netImages = new Set<string>()
  page.on('response', (res: any) => {
    const ct = res.headers()['content-type'] || ''
    const u = res.url()
    if (/^image\//.test(ct) || /\.(gif|png|webp)(\?|$)/i.test(u)) netImages.add(u)
  })

  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 })
  await sleep(6000)
  // rola devagar até o fim para disparar lazy-load
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight * 2; y += 400) {
      window.scrollTo(0, y)
      await new Promise(r => setTimeout(r, 250))
    }
    window.scrollTo(0, 0)
  })
  await sleep(2500)

  // Extrai pares {nome, src} considerando lazy (data-src/srcset) e background-image
  const entries: Array<{ name: string; src: string }> = await page.evaluate(() => {
    const out: Array<{ name: string; src: string }> = []
    const seen = new Set<string>()
    const push = (name: string, src: string) => {
      if (!src || src.startsWith('data:')) return
      name = (name || '').replace(/\s+/g, ' ').slice(0, 40).trim()
      if (!name) return
      const key = name.toLowerCase() + '|' + src
      if (seen.has(key)) return
      seen.add(key)
      out.push({ name, src })
    }
    document.querySelectorAll<HTMLElement>('img, [style*="background-image"]').forEach(el => {
      const img = el as HTMLImageElement
      const src =
        img.currentSrc ||
        img.src ||
        img.getAttribute('data-src') ||
        img.getAttribute('data-original') ||
        img.getAttribute('data-lazy-src') ||
        (img.getAttribute('srcset') || '').split(' ')[0] ||
        (getComputedStyle(el).backgroundImage.match(/url\(["']?([^"')]+)["']?\)/)?.[1] ?? '')
      if (!src) return
      const name =
        el.getAttribute('alt') ||
        el.getAttribute('title') ||
        el.closest('figure')?.querySelector('figcaption')?.textContent ||
        el.closest('td, li, .gallerybox, [class*="card"], [class*="item"]')?.textContent ||
        ''
      push(name, src)
    })
    return out
  })

  fs.writeFileSync(
    SAMPLE,
    JSON.stringify(
      {
        url: URL,
        domImages: entries.length,
        domSample: entries.slice(0, 50),
        networkImages: [...netImages].slice(0, 120),
      },
      null,
      2,
    ),
  )
  console.log(`🔎 DOM: ${entries.length} | rede: ${netImages.size} imagens (amostra em output/wikiSample-${KIND}.json)`)

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
