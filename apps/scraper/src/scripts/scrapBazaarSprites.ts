/*
  Baixa sprites custom (outfits e itens) direto do CDN do RubinOT.

  O CDN oficial do Tibia não tem os lookTypes/itens exclusivos do servidor
  (ex.: lookType 2590). Este script:

  1. Abre o bazaar do RubinOT (Puppeteer+stealth, passa pela Cloudflare)
     interceptando o tráfego de rede para descobrir de onde vêm as imagens
     de outfit (a página as expõe como blob:, então o DOM não revela a URL).
  2. Abre uma aba na origem do CDN (static.rubinot.com) e faz os downloads
     de lá — fetch same-origin, sem bloqueio de CORS.
  3. Para outfits, sonda padrões de URL prováveis e usa o tráfego
     interceptado como plano B; se nada funcionar, grava um relatório em
     output/networkSources.json para diagnóstico manual.

  Saída:
    apps/web/public/sprites/looktypes/{lookType}_{addons}.{gif|png}
    apps/web/public/sprites/items/{clientId}.{gif|png}

  Uso: npm run sprites:rubinot   (na raiz do monorepo; idempotente)
*/
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import fs from 'fs'
import path from 'path'

/** Subconjunto da Page do puppeteer usado aqui (evita depender dos tipos). */
interface Page {
  evaluate: (fn: any, ...args: any[]) => Promise<any>
  goto: (url: string, opts?: any) => Promise<any>
  on: (event: string, handler: (arg: any) => void) => void
}

puppeteer.use(StealthPlugin())

const CURRENT_FILE = path.resolve(__dirname, '../../output/CurrentAuctions.json')
const REPORT_FILE = path.resolve(__dirname, '../../output/networkSources.json')
const OUTFIT_DIR = path.resolve(__dirname, '../../../web/public/sprites/looktypes')
const ITEM_DIR = path.resolve(__dirname, '../../../web/public/sprites/items')
const CDN_ORIGIN = 'https://static.rubinot.com'
const DELAY_MS = 200

// Padrões prováveis de URL de outfit no CDN (o RubinOT espelha a estrutura
// do tibia.com oficial: /charactertrade/..., /objects/hd/...)
const OUTFIT_CANDIDATES = [
  `${CDN_ORIGIN}/charactertrade/outfits/{type}_{addons}.gif`,
  `${CDN_ORIGIN}/charactertrade/outfits/hd/{type}_{addons}.gif`,
  `${CDN_ORIGIN}/outfits/hd/{type}_{addons}.gif`,
  `${CDN_ORIGIN}/outfits/{type}_{addons}.gif`,
  `${CDN_ORIGIN}/outfits/hd/{type}.gif`,
  `${CDN_ORIGIN}/outfits/{type}.gif`,
]

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

/** fetch executado dentro de uma aba já aberta na origem da URL (sem CORS). */
async function fetchViaPage(page: Page, url: string): Promise<{ b64: string; type: string } | null> {
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
  const bazaarPage: Page = await browser.newPage()
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

  // ── Outfits: descobre o template ────────────────────────────────────────
  const samples = missingOutfits.slice(0, 3)
  let outfitTemplate: string | null = null

  for (const candidate of OUTFIT_CANDIDATES) {
    if (samples.length === 0) break
    const probe = candidate
      .replace('{type}', String(samples[0].lookType))
      .replace('{addons}', String(samples[0].addons))
    if (await fetchViaPage(cdnPage, probe)) {
      outfitTemplate = candidate
      break
    }
  }

  // Plano B: procura no tráfego interceptado uma URL de imagem com o lookType
  // de algum leilão visível na primeira página
  if (!outfitTemplate) {
    const visibleLookTypes = new Set(auctions.slice(0, 25).map(a => a.lookType).filter((n: number) => n > 0))
    outer: for (const lt of visibleLookTypes) {
      const re = new RegExp(`(?<![0-9])${lt}(?![0-9])`)
      for (const { url, type } of networkUrls) {
        if (type.startsWith('image/') && re.test(url)) {
          outfitTemplate = url.replace(re, '{type}')
          const a = auctions.find(x => x.lookType === lt)
          if (a && outfitTemplate.includes(`_${a.lookAddons}`)) {
            outfitTemplate = outfitTemplate.replace(`_${a.lookAddons}`, '_{addons}')
          }
          break outer
        }
      }
    }
  }

  console.log(`📐 Padrão de outfit: ${outfitTemplate ?? 'NÃO DETECTADO'}`)

  let ok = 0
  let fail = 0
  if (outfitTemplate) {
    for (const o of missingOutfits) {
      const url = outfitTemplate.replace('{type}', String(o.lookType)).replace('{addons}', String(o.addons))
      const file = await fetchViaPage(cdnPage, url)
      if (file) {
        save(OUTFIT_DIR, `${o.lookType}_${o.addons}`, file)
        ok++
      } else fail++
      process.stdout.write(`\r🧍 Outfits — ok: ${ok} | falhas: ${fail}`)
      await sleep(DELAY_MS)
    }
    console.log()
  } else {
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
