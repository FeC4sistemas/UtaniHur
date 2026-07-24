/*
  Baixa sprites custom (outfits e itens) direto do RubinOT.

  A API de listagem do bazaar zera as cores do personagem (lookHead/Body/
  Legs/Feet), então este script busca o DETALHE de cada leilão para obter as
  cores reais e gera o outfit pelo endpoint do próprio site (/api/outfit),
  que devolve uma sprite sheet com os frames de caminhada — idêntica à
  exibida no site oficial.

  1. Abre o bazaar do RubinOT (Puppeteer+stealth, passa pela Cloudflare).
  2. Outfits: detalhe do leilão → cores reais → gerador /api/outfit →
     salva por id do leilão em sprites/auctions/{id}.png. Combinações de
     visual repetidas são copiadas em vez de baixadas de novo.
  3. Itens: baixa do CDN (static.rubinot.com/objects/hd) por uma aba
     ancorada na origem do CDN — fetch same-origin, sem bloqueio de CORS.
  4. Se a rota de detalhe não for encontrada, cai para o modo anterior
     (cores zeradas por lookType) e grava o tráfego interceptado em
     output/networkSources.json para diagnóstico.

  Saída:
    apps/web/public/sprites/auctions/{auctionId}.{png|gif}
    apps/web/public/sprites/looktypes/{type}_{addons}_{h}_{b}_{l}_{f}.{png|gif}  (fallback)
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
const AUCTION_DIR = path.resolve(__dirname, '../../../web/public/sprites/auctions')
const OUTFIT_DIR = path.resolve(__dirname, '../../../web/public/sprites/looktypes')
const ITEM_DIR = path.resolve(__dirname, '../../../web/public/sprites/items')
const CDN_ORIGIN = 'https://static.rubinot.com'
const MAIN_ORIGIN = 'https://rubinot.com.br'
const DELAY_MS = 250

// Gerador de outfits do próprio RubinOT (descoberto via tráfego de rede).
// Aceita as cores do personagem — a sprite sai idêntica à do jogo.
const OUTFIT_ENDPOINT = `${MAIN_ORIGIN}/api/outfit?type={type}&head={head}&body={body}&legs={legs}&feet={feet}&addons={addons}&direction=3&animated=1&walk=1&size=0`

// Rotas prováveis do detalhe de um leilão (testadas na ordem)
const DETAIL_CANDIDATES = [
  `${MAIN_ORIGIN}/api/bazaar/{id}`,
  `${MAIN_ORIGIN}/api/bazaar/auction/{id}`,
  `${MAIN_ORIGIN}/api/bazaar/auctions/{id}`,
  `${MAIN_ORIGIN}/api/auction/{id}`,
]

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const hasFile = (dir: string, base: string) =>
  fs.existsSync(path.join(dir, `${base}.gif`)) || fs.existsSync(path.join(dir, `${base}.png`))

function loadNeeds() {
  const data = JSON.parse(fs.readFileSync(CURRENT_FILE, 'utf-8'))
  const auctions: any[] = (data.auctions ?? []).filter((a: any) => a.lookType > 0)

  const itemIds = new Set<number>()
  for (const a of auctions) {
    for (const item of a.highlightItems ?? []) {
      if (item.clientId > 0) itemIds.add(item.clientId)
    }
  }

  return {
    missingAuctions: auctions.filter(a => !hasFile(AUCTION_DIR, String(a.id))),
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

/** fetch de JSON na aba do bazaar. */
async function fetchJsonViaPage(page: any, url: string): Promise<any | null> {
  return page.evaluate(async (u: string) => {
    try {
      const res = await fetch(u)
      if (!res.ok) return null
      return await res.json()
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

function outfitUrl(look: { type: number; addons: number; head: number; body: number; legs: number; feet: number }) {
  return OUTFIT_ENDPOINT.replace('{type}', String(look.type))
    .replace('{head}', String(look.head))
    .replace('{body}', String(look.body))
    .replace('{legs}', String(look.legs))
    .replace('{feet}', String(look.feet))
    .replace('{addons}', String(look.addons))
}

async function main() {
  const { missingAuctions, missingItems } = loadNeeds()
  console.log(`🎨 Faltando: ${missingAuctions.length} outfits (por leilão) | ${missingItems.length} itens`)
  if (missingAuctions.length === 0 && missingItems.length === 0) {
    console.log('✅ Nada a baixar.')
    return
  }

  fs.mkdirSync(AUCTION_DIR, { recursive: true })
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

  // ── Outfits ──────────────────────────────────────────────────────────────
  if (missingAuctions.length > 0) {
    // Descobre a rota de detalhe (é ela que traz as cores reais do personagem)
    let detailTemplate: string | null = null
    for (const candidate of DETAIL_CANDIDATES) {
      const body = await fetchJsonViaPage(bazaarPage, candidate.replace('{id}', String(missingAuctions[0].id)))
      const detail = body?.auction ?? body
      if (detail && typeof detail.lookType === 'number') {
        detailTemplate = candidate
        break
      }
    }
    console.log(`📐 Rota de detalhe: ${detailTemplate ?? 'NÃO ENCONTRADA (usando cores da listagem)'}`)

    // Visuais idênticos são copiados em vez de baixados de novo
    const tupleCache = new Map<string, string>()
    let ok = 0
    let fail = 0

    for (const a of missingAuctions) {
      let look = {
        type: a.lookType,
        addons: a.lookAddons ?? 0,
        head: a.lookHead ?? 0,
        body: a.lookBody ?? 0,
        legs: a.lookLegs ?? 0,
        feet: a.lookFeet ?? 0,
      }

      if (detailTemplate) {
        const body = await fetchJsonViaPage(bazaarPage, detailTemplate.replace('{id}', String(a.id)))
        const detail = body?.auction ?? body
        if (detail && typeof detail.lookType === 'number') {
          look = {
            type: detail.lookType,
            addons: detail.lookAddons ?? look.addons,
            head: detail.lookHead ?? 0,
            body: detail.lookBody ?? 0,
            legs: detail.lookLegs ?? 0,
            feet: detail.lookFeet ?? 0,
          }
        }
        await sleep(DELAY_MS)
      }

      const tupleKey = `${look.type}_${look.addons}_${look.head}_${look.body}_${look.legs}_${look.feet}`
      const cached = tupleCache.get(tupleKey)
      if (cached) {
        fs.copyFileSync(cached, path.join(AUCTION_DIR, `${a.id}${path.extname(cached)}`))
        ok++
      } else {
        const file = await fetchImageViaPage(bazaarPage, outfitUrl(look))
        if (file) {
          const dest = save(AUCTION_DIR, String(a.id), file)
          tupleCache.set(tupleKey, dest)
          ok++
        } else {
          fail++
        }
        await sleep(DELAY_MS)
      }
      process.stdout.write(`\r🧍 Outfits — ok: ${ok} | falhas: ${fail}`)
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
