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
// animated=1&walk=1 → tira de frames de caminhada (animada no card).
const OUTFIT_ENDPOINT = `${MAIN_ORIGIN}/api/outfit?type={type}&addons={addons}&direction=3&animated=1&walk=1&size=0`

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

const CELL = 64 // tamanho de cada célula limpa gerada

/**
 * Baixa a tira do gerador e a normaliza: detecta a área do personagem (pixels
 * não-transparentes) usando a união de todos os frames, recorta o vazio e
 * redesenha cada frame centralizado numa célula CELL×CELL. Roda no navegador
 * (mesma origem → canvas não fica "tainted"). Retorna PNG da tira limpa.
 */
async function fetchCleanOutfit(page: any, url: string): Promise<{ b64: string; type: string } | null> {
  return page.evaluate(
    async (u: string, cell: number) => {
      const load = (src: string) =>
        new Promise<HTMLImageElement | null>(resolve => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => resolve(img)
          img.onerror = () => resolve(null)
          img.src = src
        })

      const img = await load(u)
      if (!img || !img.naturalWidth) return null

      const w = img.naturalWidth
      const h = img.naturalHeight
      const frames = Math.max(1, Math.round(w / h)) // frames quadrados lado a lado
      const fw = Math.round(w / frames)
      const fh = h

      const src = document.createElement('canvas')
      src.width = w
      src.height = h
      const sctx = src.getContext('2d')!
      sctx.imageSmoothingEnabled = false
      sctx.drawImage(img, 0, 0)

      // Caixa do personagem (união entre todos os frames), em coords do frame
      let minx = fw
      let miny = fh
      let maxx = -1
      let maxy = -1
      for (let f = 0; f < frames; f++) {
        const d = sctx.getImageData(f * fw, 0, fw, fh).data
        for (let py = 0; py < fh; py++) {
          for (let px = 0; px < fw; px++) {
            if (d[(py * fw + px) * 4 + 3] > 12) {
              if (px < minx) minx = px
              if (px > maxx) maxx = px
              if (py < miny) miny = py
              if (py > maxy) maxy = py
            }
          }
        }
      }
      if (maxx < 0) {
        minx = 0
        miny = 0
        maxx = fw - 1
        maxy = fh - 1
      }
      const bw = maxx - minx + 1
      const bh = maxy - miny + 1
      const scale = Math.min((cell * 0.92) / bw, (cell * 0.92) / bh)
      const dw = bw * scale
      const dh = bh * scale

      // Nova tira: frames células CELL×CELL, personagem centralizado em cada uma
      const out = document.createElement('canvas')
      out.width = cell * frames
      out.height = cell
      const octx = out.getContext('2d')!
      octx.imageSmoothingEnabled = false
      for (let f = 0; f < frames; f++) {
        const dx = f * cell + (cell - dw) / 2
        const dy = (cell - dh) / 2
        octx.drawImage(src, f * fw + minx, miny, bw, bh, dx, dy, dw, dh)
      }
      return { b64: out.toDataURL('image/png').split(',')[1], type: 'image/png' }
    },
    url,
    CELL,
  )
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
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
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
      const file = await fetchCleanOutfit(bazaarPage, outfitUrl(o))
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
