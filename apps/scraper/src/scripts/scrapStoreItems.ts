/*
  DIAGNÓSTICO: quais "itens de store" realmente existem no RubinOT?

  A API de leilão (/api/bazaar/{id}) só expõe algumas features como flag no
  objeto `general` (charmExpansion, thirdPrey, permanentWeeklyTaskSlot,
  hirelingCount, gpActive). Itens físicos como Training Dummy, Imbuement Shrine,
  Reward Shrine, Mailbox e World Transfer, se existirem, aparecem no array
  `storeItems` (store inbox / depot) — não como flag.

  Este script busca uma AMOSTRA de leilões atuais e coleta os nomes distintos
  vistos em `storeItems` (e, para os alvos, também em `items`), para confirmar
  preto-no-branco o que o servidor tem. NÃO toca no AuctionDetails.json.

  Uso (na raiz do monorepo):
    npm run storescan          → amostra padrão (400 leilões)
    npm run storescan 1000     → amostra de 1000
    npm run storescan all      → todos os leilões atuais

  Saída: output/storeItemNames.json
*/
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import fs from 'fs'
import path from 'path'

puppeteer.use(StealthPlugin())

const CURRENT_FILE = path.resolve(__dirname, '../../output/CurrentAuctions.json')
const OUT_FILE = path.resolve(__dirname, '../../output/storeItemNames.json')
const MAIN_ORIGIN = 'https://rubinot.com.br'
const DELAY_MS = 300
const DEFAULT_SAMPLE = 400

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Nomes-alvo (minúsculos) que queremos confirmar. `name.includes(w)` cobre
// variações ("premium mailbox" casa em "mailbox").
const STORE_WATCHLIST = [
  'training dummy', 'exercise dummy', 'gold pouch', 'imbuement shrine',
  'reward shrine', 'mailbox', 'world transfer', 'prey slot',
  'charm expansion', 'hireling lamp',
]
type NameStat = { count: number; chars: number; fromStoreItems: number; fromItems: number; sampleDescription?: string }
const storeNames = new Map<string, NameStat>()
const watchHits = new Map<string, NameStat>()
let charsScanned = 0

function collectStoreNames(body: any) {
  charsScanned++
  const seenStore = new Set<string>()
  const seenWatch = new Set<string>()
  const bump = (map: Map<string, NameStat>, key: string, it: any, from: 'store' | 'items', seen: Set<string>) => {
    const e = map.get(key) ?? { count: 0, chars: 0, fromStoreItems: 0, fromItems: 0 }
    e.count += typeof it?.count === 'number' ? it.count : 1
    if (from === 'store') e.fromStoreItems++
    else e.fromItems++
    if (!seen.has(key)) {
      e.chars++
      seen.add(key)
    }
    if (!e.sampleDescription && it?.description) e.sampleDescription = String(it.description).split('\n')[0]
    map.set(key, e)
  }
  const scan = (arr: any, from: 'store' | 'items') => {
    for (const it of Array.isArray(arr) ? arr : []) {
      const name = String(it?.name ?? '').trim().toLowerCase()
      if (!name) continue
      if (from === 'store') bump(storeNames, name, it, from, seenStore)
      if (STORE_WATCHLIST.some(w => name.includes(w))) bump(watchHits, name, it, from, seenWatch)
    }
  }
  scan(body?.storeItems, 'store')
  scan(body?.items, 'items') // só os que batem na watchlist entram (evita ruído de gear)
}

function writeOut() {
  const sortStat = (m: Map<string, NameStat>) =>
    Object.fromEntries([...m.entries()].sort((a, b) => b[1].chars - a[1].chars))
  fs.writeFileSync(
    OUT_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        charsScanned,
        watchlist: sortStat(watchHits), // itens-alvo confirmados (com contagem)
        storeItems: sortStat(storeNames), // todos os nomes vistos em storeItems
      },
      null,
      2,
    ),
  )
}

async function main() {
  if (!fs.existsSync(CURRENT_FILE)) {
    console.log('⚠️  output/CurrentAuctions.json não encontrado. Rode `npm run current` antes.')
    return
  }
  const data = JSON.parse(fs.readFileSync(CURRENT_FILE, 'utf-8'))
  const all: any[] = data.auctions ?? []
  if (all.length === 0) {
    console.log('Nenhum leilão em CurrentAuctions.json.')
    return
  }

  const arg = (process.argv[2] ?? '').toLowerCase()
  const sampleSize = arg === 'all' ? all.length : Number(arg) > 0 ? Number(arg) : DEFAULT_SAMPLE
  const auctions = all.slice(0, sampleSize)
  console.log(`🎯 Diagnóstico de itens de store: ${auctions.length}/${all.length} leilões`)

  console.log('🚀 Iniciando navegador com stealth...')
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: puppeteer.executablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null,
  })
  const page = await browser.newPage()

  console.log('🌐 Abrindo rubinot.com.br/bazaar...')
  await page.goto(`${MAIN_ORIGIN}/bazaar`, { waitUntil: 'networkidle0', timeout: 60000 })
  console.log('⏳ Aguardando Cloudflare...')
  await sleep(8000)

  const fetchDetail = async (id: number): Promise<any> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const body = await page.evaluate(async (u: string) => {
        try {
          const res = await fetch(u)
          if (!res.ok) return { __status: res.status }
          return await res.json()
        } catch (e: any) {
          return { __error: e.message }
        }
      }, `${MAIN_ORIGIN}/api/bazaar/${id}`)
      if (body?.general) return body
      await sleep(600 * (attempt + 1))
    }
    return null
  }

  let ok = 0
  let fail = 0
  let processed = 0
  for (const a of auctions) {
    const body = await fetchDetail(a.id)
    if (body?.general) {
      collectStoreNames(body)
      ok++
    } else fail++
    processed++
    if (processed % 25 === 0) {
      process.stdout.write(`\r🔎 ok: ${ok} | falhas: ${fail} | ${processed}/${auctions.length}`)
      writeOut() // salva parcial para não perder em caso de interrupção
    }
    await sleep(DELAY_MS)
  }
  writeOut()

  console.log(`\n✅ ${charsScanned} personagens escaneados (ok: ${ok}, falhas: ${fail})`)
  console.log(`📄 Resultado: output/storeItemNames.json`)
  const watch = [...watchHits.entries()]
  if (watch.length) {
    console.log('🎯 Itens-alvo encontrados:')
    for (const [name, s] of watch.sort((a, b) => b[1].chars - a[1].chars)) {
      console.log(`   • ${name} — ${s.chars} chars (${s.count} un.)`)
    }
  } else {
    console.log('🎯 Nenhum item da watchlist (Training Dummy, Imbuement/Reward Shrine, Mailbox, World Transfer...) apareceu na amostra.')
  }

  await browser.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
