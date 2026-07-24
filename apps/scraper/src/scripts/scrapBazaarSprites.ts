/*
  Baixa sprites custom (outfits e itens) direto do site do RubinOT.

  O CDN oficial do Tibia não tem os lookTypes/itens exclusivos do servidor
  (ex.: lookType 2590). Este script abre o bazaar do RubinOT com o mesmo
  Puppeteer+stealth do scraper, descobre automaticamente o padrão de URL das
  imagens de outfit/item usadas pela página e baixa apenas o que falta em:

    apps/web/public/sprites/looktypes/{lookType}_{addons}.{gif|png}
    apps/web/public/sprites/items/{clientId}.{gif|png}

  Uso: npm run sprites:rubinot   (na raiz do monorepo)

  Se a detecção automática falhar (layout do site mudou), o script grava um
  relatório em output/spriteSources.json com todas as URLs de imagem vistas
  na página — dá para identificar o padrão manualmente por lá.
*/
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import fs from 'fs'
import path from 'path'

puppeteer.use(StealthPlugin())

const CURRENT_FILE = path.resolve(__dirname, '../../output/CurrentAuctions.json')
const REPORT_FILE = path.resolve(__dirname, '../../output/spriteSources.json')
const OUTFIT_DIR = path.resolve(__dirname, '../../../web/public/sprites/looktypes')
const ITEM_DIR = path.resolve(__dirname, '../../../web/public/sprites/items')
const DELAY_MS = 300

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

interface OutfitPair {
  lookType: number
  addons: number
}

function loadNeeds() {
  const data = JSON.parse(fs.readFileSync(CURRENT_FILE, 'utf-8'))
  const auctions: any[] = data.auctions ?? []

  const pairKeys = new Set<string>()
  const outfits: OutfitPair[] = []
  const itemIds = new Set<number>()

  for (const a of auctions) {
    const key = `${a.lookType}_${a.lookAddons ?? 0}`
    if (a.lookType > 0 && !pairKeys.has(key)) {
      pairKeys.add(key)
      outfits.push({ lookType: a.lookType, addons: a.lookAddons ?? 0 })
    }
    for (const item of a.highlightItems ?? []) {
      if (item.clientId > 0) itemIds.add(item.clientId)
    }
  }

  const hasFile = (dir: string, base: string) =>
    fs.existsSync(path.join(dir, `${base}.gif`)) || fs.existsSync(path.join(dir, `${base}.png`))

  return {
    auctions,
    missingOutfits: outfits.filter(o => !hasFile(OUTFIT_DIR, `${o.lookType}_${o.addons}`)),
    missingItems: [...itemIds].filter(id => !hasFile(ITEM_DIR, String(id))),
  }
}

/** Constrói um template substituindo o número alvo por um placeholder. */
function toTemplate(src: string, value: number, placeholder: string): string | null {
  const re = new RegExp(`(?<![0-9])${value}(?![0-9])`)
  if (!re.test(src)) return null
  return src.replace(re, placeholder)
}

async function main() {
  const { auctions, missingOutfits, missingItems } = loadNeeds()
  console.log(`🎨 Faltando: ${missingOutfits.length} outfits | ${missingItems.length} itens`)
  if (missingOutfits.length === 0 && missingItems.length === 0) {
    console.log('✅ Nada a baixar.')
    return
  }

  fs.mkdirSync(OUTFIT_DIR, { recursive: true })
  fs.mkdirSync(ITEM_DIR, { recursive: true })

  console.log('🚀 Iniciando navegador com stealth...')
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: puppeteer.executablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null,
  })
  const page = await browser.newPage()

  console.log('🌐 Abrindo rubinot.com.br/bazaar...')
  await page.goto('https://rubinot.com.br/bazaar', { waitUntil: 'networkidle0', timeout: 60000 })
  console.log('⏳ Aguardando Cloudflare...')
  await sleep(8000)

  // Coleta todas as URLs de imagem presentes na página (img src + backgrounds)
  const collectImageUrls = () =>
    page.evaluate(() => {
      const urls = new Set<string>()
      document.querySelectorAll('img').forEach(img => {
        if (img.currentSrc) urls.add(img.currentSrc)
        else if (img.src) urls.add(img.src)
      })
      document.querySelectorAll<HTMLElement>('*').forEach(el => {
        const bg = getComputedStyle(el).backgroundImage
        const m = bg && bg.match(/url\(["']?([^"')]+)["']?\)/)
        if (m) urls.add(new URL(m[1], location.href).href)
      })
      return [...urls]
    })

  let imageUrls = await collectImageUrls()
  fs.writeFileSync(REPORT_FILE, JSON.stringify({ collectedAt: new Date().toISOString(), imageUrls }, null, 2))
  console.log(`🔎 ${imageUrls.length} URLs de imagem coletadas (relatório em output/spriteSources.json)`)

  // Descobre o padrão de URL usando um leilão visível na primeira página
  const firstPage: any = await page.evaluate(async () => {
    const res = await fetch('https://rubinot.com.br/api/bazaar?page=1&limit=25&sortBy=auction_end&sortOrder=asc')
    return res.ok ? res.json() : null
  })
  const visible: any[] = firstPage?.auctions ?? auctions.slice(0, 25)

  let outfitTemplate: string | null = null
  let itemTemplate: string | null = null

  for (const a of visible) {
    if (!outfitTemplate && a.lookType > 0) {
      for (const src of imageUrls) {
        const t = toTemplate(src, a.lookType, '{type}')
        if (t) {
          outfitTemplate = t.includes(`_${a.lookAddons}`)
            ? t.replace(`_${a.lookAddons}`, '_{addons}')
            : t
          break
        }
      }
    }
    if (!itemTemplate) {
      for (const item of a.highlightItems ?? []) {
        for (const src of imageUrls) {
          const t = toTemplate(src, item.clientId, '{id}')
          if (t) {
            itemTemplate = t
            break
          }
        }
        if (itemTemplate) break
      }
    }
    if (outfitTemplate && itemTemplate) break
  }

  console.log(`📐 Padrão de outfit: ${outfitTemplate ?? 'NÃO DETECTADO'}`)
  console.log(`📐 Padrão de item:   ${itemTemplate ?? 'NÃO DETECTADO'}`)
  if (!outfitTemplate && !itemTemplate) {
    console.log('❌ Não foi possível detectar os padrões. Veja output/spriteSources.json e me mande alguns exemplos de URL.')
    await browser.close()
    return
  }

  // Baixa via fetch dentro da página (aproveita cookies/Cloudflare da sessão)
  const download = async (url: string): Promise<{ b64: string; type: string } | null> =>
    page.evaluate(async (u: string) => {
      try {
        const res = await fetch(u)
        if (!res.ok) return null
        const type = res.headers.get('content-type') || ''
        const buf = await res.arrayBuffer()
        let bin = ''
        const bytes = new Uint8Array(buf)
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
        return { b64: btoa(bin), type }
      } catch {
        return null
      }
    }, url)

  const save = (dir: string, base: string, file: { b64: string; type: string }) => {
    const ext = file.type.includes('png') ? 'png' : 'gif'
    fs.writeFileSync(path.join(dir, `${base}.${ext}`), Buffer.from(file.b64, 'base64'))
  }

  let ok = 0
  let fail = 0

  if (outfitTemplate) {
    for (const o of missingOutfits) {
      const url = outfitTemplate.replace('{type}', String(o.lookType)).replace('{addons}', String(o.addons))
      const file = await download(url)
      if (file) {
        save(OUTFIT_DIR, `${o.lookType}_${o.addons}`, file)
        ok++
      } else fail++
      process.stdout.write(`\r🧍 Outfits — ok: ${ok} | falhas: ${fail}`)
      await sleep(DELAY_MS)
    }
    console.log()
  }

  ok = 0
  fail = 0
  if (itemTemplate) {
    for (const id of missingItems) {
      const file = await download(itemTemplate.replace('{id}', String(id)))
      if (file) {
        save(ITEM_DIR, String(id), file)
        ok++
      } else fail++
      process.stdout.write(`\r🎒 Itens — ok: ${ok} | falhas: ${fail}`)
      await sleep(DELAY_MS)
    }
    console.log()
  }

  console.log('✅ Concluído.')
  await browser.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
