/*
  Baixa sprites custom (outfits e itens) direto do CDN do RubinOT.

  O CDN oficial do Tibia não tem os lookTypes/itens exclusivos do servidor
  (ex.: lookType 2590). Este script:

  1. Abre o bazaar do RubinOT (Puppeteer+stealth, passa pela Cloudflare).
  2. Outfits: usa o gerador do próprio site (/api/outfit), que aceita as
     cores do personagem (lookHead/Body/Legs/Feet) — cada sprite sai
     idêntica à do jogo. O fetch roda na aba do bazaar (same-origin).
  3. Itens: baixa do CDN (static.rubinot.com/objects/hd) por uma aba
     ancorada na origem do CDN — fetch same-origin, sem bloqueio de CORS.
  4. Se o gerador falhar, grava o tráfego de rede interceptado em
     output/networkSources.json para diagnóstico manual.

  Saída:
    apps/web/public/sprites/looktypes/{type}_{addons}_{head}_{body}_{legs}_{feet}.{gif|png}
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
const DELAY_MS = 300

// Gerador de outfits do próprio RubinOT (descoberto via tráfego de rede da
// página do bazaar). Aceita as cores do personagem — a sprite sai idêntica
// à do jogo.
const OUTFIT_ENDPOINT = `${MAIN_ORIGIN}/api/outfit?type={type}&head={head}&body={body}&legs={legs}&feet={feet}&addons={addons}&direction=3&animated=1&walk=1&size=0`

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

interface OutfitLook {
  lookType: number
  addons: number
  head: number
  body: number
  legs: number
  feet: number
  /** Nome do arquivo: {type}_{addons}_{head}_{body}_{legs}_{feet} */
  key: string
}

function lookKey(a: any): string {
  return `${a.lookType}_${a.lookAddons ?? 0}_${a.lookHead ?? 0}_${a.lookBody ?? 0}_${a.lookLegs ?? 0}_${a.lookFeet ?? 0}`
}

function loadNeeds() {
  const data = JSON.parse(fs.readFileSync(CURRENT_FILE, 'utf-8'))
  const auctions: any[] = data.auctions ?? []

  const looks = new Map<string, OutfitLook>()
  const itemIds = new Set<number>()

  for (const a of auctions) {
    if (a.lookType > 0) {
      const key = lookKey(a)
      if (!looks.has(key)) {
        looks.set(key, {
          lookType: a.lookType,
          addons: a.lookAddons ?? 0,
          head: a.lookHead ?? 0,
          body: a.lookBody ?? 0,
          legs: a.lookLegs ?? 0,
          feet: a.lookFeet ?? 0,
          key,
        })
      }
    }
    for (const item of a.highlightItems ?? []) {
      if (item.clientId > 0) itemIds.add(item.clientId)
    }
  }

  const hasFile = (dir: string, base: string) =>
    fs.existsSync(path.join(dir, `${base}.gif`)) || fs.existsSync(path.join(dir, `${base}.png`))

  return {
    auctions,
    missingOutfits: [...looks.values()].filter(o => !hasFile(OUTFIT_DIR, o.key)),
    missingItems: [...itemIds].filter(id => !hasFile(ITEM_DIR, String(id))),
  }
}

/** fetch executado dentro de uma aba já aberta na origem da URL (sem CORS). */
async function fetchViaPage(page: any, url: string): Promise<{ b64: string; type: string } | null> {
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

function save(dir: string, base: string, file: { b64: string; type: string }) {
  const ext = file.type.includes('png') ? 'png' : 'gif'
  fs.writeFileSync(path.join(dir, `${base}.${ext}`), Buffer.from(file.b64, 'base64'))
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

  // Intercepta o tráfego do bazaar para descobrir a fonte real dos outfits
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

  // Aba ancorada na origem do CDN: fetches a partir dela são same-origin
  const cdnPage = await browser.newPage()
  await cdnPage
    .goto(`${CDN_ORIGIN}/objects/hd/${missingItems[0] ?? 22400}.gif`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    .catch(() => {})
  await sleep(1500)

  // Escolhe a aba cuja origem casa com a URL — fetch precisa ser same-origin
  const pageFor = (url: string) => (url.startsWith(CDN_ORIGIN) ? cdnPage : bazaarPage)

  const outfitUrl = (o: OutfitLook) =>
    OUTFIT_ENDPOINT.replace('{type}', String(o.lookType))
      .replace('{head}', String(o.head))
      .replace('{body}', String(o.body))
      .replace('{legs}', String(o.legs))
      .replace('{feet}', String(o.feet))
      .replace('{addons}', String(o.addons))

  // ── Outfits: valida o gerador com uma amostra ───────────────────────────
  let generatorOk = false
  if (missingOutfits.length > 0) {
    const probe = outfitUrl(missingOutfits[0])
    generatorOk = (await fetchViaPage(pageFor(probe), probe)) !== null
    console.log(`📐 Gerador de outfit (${MAIN_ORIGIN}/api/outfit): ${generatorOk ? 'OK' : 'FALHOU'}`)
  }

  let ok = 0
  let fail = 0
  if (generatorOk) {
    for (const o of missingOutfits) {
      const url = outfitUrl(o)
      const file = await fetchViaPage(pageFor(url), url)
      if (file) {
        save(OUTFIT_DIR, o.key, file)
        ok++
      } else fail++
      process.stdout.write(`\r🧍 Outfits — ok: ${ok} | falhas: ${fail}`)
      await sleep(DELAY_MS)
    }
    console.log()
  } else if (missingOutfits.length > 0) {
    fs.writeFileSync(
      REPORT_FILE,
      JSON.stringify({ collectedAt: new Date().toISOString(), networkUrls }, null, 2),
    )
    console.log('⚠️  Tráfego de rede salvo em output/networkSources.json — me mande esse arquivo para eu ajustar o padrão.')
  }

  // ── Itens: same-origin no CDN, padrão já conhecido ──────────────────────
  ok = 0
  fail = 0
  for (const id of missingItems) {
    const file = await fetchViaPage(cdnPage, `${CDN_ORIGIN}/objects/hd/${id}.gif`)
    if (file) {
      save(ITEM_DIR, String(id), file)
      ok++
    } else fail++
    process.stdout.write(`\r🎒 Itens — ok: ${ok} | falhas: ${fail}`)
    await sleep(DELAY_MS)
  }
  console.log('\n✅ Concluído.')

  await browser.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
