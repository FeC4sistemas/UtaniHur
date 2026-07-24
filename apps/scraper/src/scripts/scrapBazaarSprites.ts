/*
  Baixa sprites custom (outfits e itens) direto do RubinOT.

  1. Abre o bazaar do RubinOT (Puppeteer+stealth, passa pela Cloudflare).
  2. Outfits: gera cada combinação (lookType, addons) pelo endpoint do
     próprio site (/api/outfit), que devolve uma sprite sheet com os frames
     de caminhada. As cores usam o padrão do gerador.
  3. Itens: baixa do CDN (static.rubinot.com/objects/hd) por uma aba
     ancorada na origem do CDN — fetch same-origin, sem bloqueio de CORS.
  4. Se o gerador falhar, grava o tráfego interceptado em
     output/networkSources.json para diagnóstico.

  Saída:
    apps/web/public/sprites/looktypes/{type}_{addons}.{png|gif}
    apps/web/public/sprites/items/{clientId}.{gif|png}

  Uso: npm run sprites:rubinot   (na raiz do monorepo; idempotente)
*/
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import fs from 'fs'
import path from 'path'

puppeteer.use(StealthPlugin())

const CURRENT_FILE = path.resolve(__dirname, '../../output/CurrentAuctions.json')
const REPORT_FILE = path.resolve(__dirname, '../../output/networkSources.json')
const OUTFIT_DIR = path.resolve(__dirname, '../../../web/public/sprites/looktypes')
const ITEM_DIR = path.resolve(__dirname, '../../../web/public/sprites/items')
const CDN_ORIGIN = 'https://static.rubinot.com'
const MAIN_ORIGIN = 'https://rubinot.com.br'
const DELAY_MS = 250

// Gerador de outfits do próprio RubinOT (descoberto via tráfego de rede).
// animated=0 → um único frame (imagem estática), centralizável no card.
const OUTFIT_ENDPOINT = `${MAIN_ORIGIN}/api/outfit?type={type}&addons={addons}&direction=3&animated=0&walk=0&size=0`

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const hasFile = (dir: string, base: string) =>
  fs.existsSync(path.join(dir, `${base}.gif`)) || fs.existsSync(path.join(dir, `${base}.png`))

interface OutfitPair {
  lookType: number
  addons: number
  key: string
}

function loadNeeds() {
  const data = JSON.parse(fs.readFileSync(CURRENT_FILE, 'utf-8'))
  const auctions: any[] = (data.auctions ?? []).filter((a: any) => a.lookType > 0)

  const pairs = new Map<string, OutfitPair>()
  const itemIds = new Set<number>()
  for (const a of auctions) {
    const key = `${a.lookType}_${a.lookAddons ?? 0}`
    if (!pairs.has(key)) pairs.set(key, { lookType: a.lookType, addons: a.lookAddons ?? 0, key })
    for (const item of a.highlightItems ?? []) {
      if (item.clientId > 0) itemIds.add(item.clientId)
    }
  }

  return {
    missingOutfits: [...pairs.values()].filter(p => !hasFile(OUTFIT_DIR, p.key)),
    missingItems: [...itemIds].filter(id => !hasFile(ITEM_DIR, String(id))),
  }
}

/** fetch de imagem executado dentro de uma aba já aberta na origem da URL (sem CORS). */
async function fetchImageViaPage(page: any, url: string): Promise<{ b64: string; type: string } | null> {
  return page.evaluate(async (u: string) => {
    try {
      const res = await fetch(u)
      if (!res.ok) return null
      const type = res.headers.get('content-type') || ''
      if (!type.startsWith('image/')) return null
      const bytes = new Uint8Array(await res.arrayBuffer())
      let bin = ''
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
      return { b64: btoa(bin), type }
    } catch {
      return null
    }
  }, url)
}

function save(dir: string, base: string, file: { b64: string; type: string }): string {
  const ext = file.type.includes('png') ? 'png' : 'gif'
  const dest = path.join(dir, `${base}.${ext}`)
  fs.writeFileSync(dest, Buffer.from(file.b64, 'base64'))
  return dest
}

function outfitUrl(o: OutfitPair) {
  return OUTFIT_ENDPOINT.replace('{type}', String(o.lookType)).replace('{addons}', String(o.addons))
}

async function main() {
  const { missingOutfits, missingItems } = loadNeeds()
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

  const networkUrls: Array<{ url: string; type: string }> = []
  const bazaarPage = await browser.newPage()
  bazaarPage.on('response', (res: any) => {
    const type = res.headers()['content-type'] || ''
    const url = res.url()
    if (!url.startsWith('data:') && !url.startsWith('blob:')) {
      networkUrls.push({ url, type })
    }
  })

  console.log('🌐 Abrindo rubinot.com.br/bazaar...')
  await bazaarPage.goto('https://rubinot.com.br/bazaar', { waitUntil: 'networkidle0', timeout: 60000 })
  console.log('⏳ Aguardando Cloudflare...')
  await sleep(8000)

  // ── Outfits: gerador do próprio site (mesma origem) ─────────────────────
  if (missingOutfits.length > 0) {
    let ok = 0
    let fail = 0
    for (const o of missingOutfits) {
      const file = await fetchImageViaPage(bazaarPage, outfitUrl(o))
      if (file) {
        save(OUTFIT_DIR, o.key, file)
        ok++
      } else fail++
      process.stdout.write(`\r🧍 Outfits — ok: ${ok} | falhas: ${fail}`)
      await sleep(DELAY_MS)
    }
    console.log()

    if (ok === 0) {
      fs.writeFileSync(
        REPORT_FILE,
        JSON.stringify({ collectedAt: new Date().toISOString(), networkUrls }, null, 2),
      )
      console.log('⚠️  Tráfego de rede salvo em output/networkSources.json — me mande esse arquivo para eu ajustar.')
    }
  }

  // ── Itens: same-origin no CDN, padrão já conhecido ──────────────────────
  if (missingItems.length > 0) {
    const cdnPage = await browser.newPage()
    await cdnPage
      .goto(`${CDN_ORIGIN}/objects/hd/${missingItems[0]}.gif`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      .catch(() => {})
    await sleep(1500)

    let ok = 0
    let fail = 0
    for (const id of missingItems) {
      const file = await fetchImageViaPage(cdnPage, `${CDN_ORIGIN}/objects/hd/${id}.gif`)
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
