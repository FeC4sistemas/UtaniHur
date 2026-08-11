/*
  Enriquece os leilões com o DETALHE de cada personagem.

  Rota descoberta: GET https://rubinot.com.br/api/bazaar/{id}
  Retorna { auction, player, general, storages }. O objeto `general` traz os
  campos que a listagem não tem: skills completas (fist/fishing), mounts,
  outfits, títulos, boss points, wheel, dust, tasks, prey, charm expansion etc.

  Saída: output/AuctionDetails.json = { enrichedAt, byId: { [id]: {...} } }
         output/auctionDetailSample.json (detalhe cru do 1º, p/ referência)

  Uso: npm run details   (na raiz do monorepo; idempotente por execução)
*/
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import fs from 'fs'
import path from 'path'

puppeteer.use(StealthPlugin())

const CURRENT_FILE = path.resolve(__dirname, '../../output/CurrentAuctions.json')
const OUT_FILE = path.resolve(__dirname, '../../output/AuctionDetails.json')
const SAMPLE_FILE = path.resolve(__dirname, '../../output/auctionDetailSample.json')
const MAIN_ORIGIN = 'https://rubinot.com.br'
const DELAY_MS = 300

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const num = (v: any): number | undefined => (typeof v === 'number' ? v : undefined)
const bool = (v: any): boolean | undefined => (typeof v === 'boolean' ? v : undefined)

function extractExtra(body: any) {
  const general = body?.general
  if (!general) return null
  const s = general.skills ?? {}
  // Outfits/mounts possuídos (para o filtro visual). Guarda o bitmask de
  // addons por outfit (1 = addon 1, 2 = addon 2), unindo se repetir.
  const outfitMap = new Map<string, number>()
  if (Array.isArray(body.outfits)) {
    for (const o of body.outfits) {
      if (o?.info?.unlocked && o.info.name) {
        outfitMap.set(o.info.name, (outfitMap.get(o.info.name) ?? 0) | (typeof o.addons === 'number' ? o.addons : 0))
      }
    }
  }
  const outfits = [...outfitMap.entries()].map(([name, addons]) => ({ name, addons }))
  const mounts = Array.isArray(body.mounts)
    ? [...new Set(body.mounts.map((m: any) => m?.name).filter(Boolean))]
    : []
  // Nomes (minúsculos) dos bosses no bosstiary — usados para inferir quests feitas
  const bosstiary = Array.isArray(body.bosstiaries)
    ? [...new Set(body.bosstiaries.map((b: any) => String(b?.name ?? '').toLowerCase()).filter(Boolean))]
    : []
  return {
    outfits,
    mounts,
    bosstiary,
    skills: { fist: num(s.fist), fishing: num(s.fishing) },
    extra: {
      mountsCount: num(general.mountsCount),
      outfitsCount: num(general.outfitsCount),
      titlesCount: num(general.titlesCount),
      bossPoints: num(general.bossPoints),
      wheelPoints: num(general.wheelPoints),
      maxWheelPoints: num(general.maxWheelPoints),
      dust: num(general.dust),
      dustMax: num(general.dustMax),
      huntingTaskPoints: num(general.huntingTaskPoints),
      preyWildcards: num(general.preyWildcards),
      hirelingCount: num(general.hirelingCount),
      thirdPrey: bool(general.thirdPrey),
      thirdHunting: bool(general.thirdHunting),
      charmExpansion: bool(general.charmExpansion),
      permanentWeeklyTaskSlot: bool(general.permanentWeeklyTaskSlot),
      gpActive: bool(general.gpActive),
      gpPoints: num(general.gpPoints),
    },
  }
}

// ── Diagnóstico de itens de store ──────────────────────────────────────────
// Coleta os nomes distintos que aparecem em `storeItems` (e itens observados)
// para descobrir quais "itens de store" (Training Dummy, Imbuement Shrine,
// Reward Shrine, Mailbox, Gold Pouch...) realmente existem no RubinOT — a API
// de leilão não os expõe como flags, então a única forma de confirmar é ver se
// aparecem como item físico no depot/store inbox. Grava output/storeItemNames.json.
const STORE_NAMES_FILE = path.resolve(__dirname, '../../output/storeItemNames.json')
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
let storeCharsScanned = 0

function collectStoreNames(body: any) {
  storeCharsScanned++
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

function writeStoreNames() {
  const sortStat = (m: Map<string, NameStat>) =>
    Object.fromEntries([...m.entries()].sort((a, b) => b[1].chars - a[1].chars))
  fs.writeFileSync(
    STORE_NAMES_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        charsScanned: storeCharsScanned,
        watchlist: sortStat(watchHits), // itens-alvo confirmados (com contagem)
        storeItems: sortStat(storeNames), // todos os nomes vistos em storeItems
      },
      null,
      2,
    ),
  )
}

async function main() {
  const data = JSON.parse(fs.readFileSync(CURRENT_FILE, 'utf-8'))
  const auctions: any[] = data.auctions ?? []
  if (auctions.length === 0) {
    console.log('Nenhum leilão em CurrentAuctions.json.')
    return
  }

  console.log('🚀 Iniciando navegador com stealth...')
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null,
  })
  const page = await browser.newPage()

  console.log('🌐 Abrindo rubinot.com.br/bazaar...')
  await page.goto(`${MAIN_ORIGIN}/bazaar`, { waitUntil: 'networkidle0', timeout: 60000 })
  console.log('⏳ Aguardando Cloudflare...')
  await sleep(8000)

  // Retoma: mantém o que já foi salvo e busca só o que falta
  let byId: Record<number, any> = {}
  if (fs.existsSync(OUT_FILE)) {
    try {
      byId = JSON.parse(fs.readFileSync(OUT_FILE, 'utf-8')).byId ?? {}
    } catch {
      byId = {}
    }
  }

  // fetch com retry + backoff (as falhas costumam ser throttling)
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
      await sleep(600 * (attempt + 1)) // backoff: 0.6s, 1.2s
    }
    return null
  }

  // valida com o primeiro e grava amostra
  const sample = await fetchDetail(auctions[0].id)
  if (!sample?.general) {
    console.log('⚠️  A rota /api/bazaar/{id} não retornou `general`. Amostra salva para revisão.')
    fs.writeFileSync(SAMPLE_FILE, JSON.stringify(sample ?? { error: 'sem resposta' }, null, 2))
    await browser.close()
    return
  }
  fs.writeFileSync(SAMPLE_FILE, JSON.stringify(sample, null, 2))
  console.log('📐 Rota OK: /api/bazaar/{id} (campo `general` presente)')

  // Catálogo global de outfits/mounts (para o seletor), montado a partir dos
  // dados reais — assim os nomes batem exatamente com os do filtro.
  const wardrobeFile = path.resolve(__dirname, '../../../web/public/wardrobe.json')
  type WOut = { name: string; store: boolean; male: boolean; female: boolean; ltMale?: number; ltFemale?: number }
  const wOut = new Map<string, WOut>()
  const wMnt = new Map<string, { name: string; store: boolean }>()
  // Mescla com o wardrobe.json existente (mantém flags de store dos mounts, vindas das pastas)
  try {
    const prev = JSON.parse(fs.readFileSync(wardrobeFile, 'utf-8'))
    for (const o of prev.outfits ?? []) wOut.set(o.name, o)
    for (const m of prev.mounts ?? []) wMnt.set(m.name, m)
  } catch {
    /* sem manifesto anterior */
  }
  const collectWardrobe = (body: any) => {
    const sex = body?.player?.sex // 0 = masculino, 1 = feminino
    for (const o of body?.outfits ?? []) {
      const info = o?.info
      if (!info?.name) continue
      const e: WOut = wOut.get(info.name) ?? { name: info.name, store: false, male: false, female: false }
      if (info.source === 'store') e.store = true
      // lookType por sexo → o seletor usa o outfit-proxy da wiki como fallback,
      // cobrindo até os outfits exclusivos do RubinOT (sem baixar nada).
      const lt = num(info.looktype ?? info.lookType ?? info.type)
      if (sex === 0) {
        e.male = true
        if (lt) e.ltMale = lt
      } else {
        e.female = true
        if (lt) e.ltFemale = lt
      }
      wOut.set(info.name, e)
    }
    for (const m of body?.mounts ?? []) {
      if (m?.name && !wMnt.has(m.name)) wMnt.set(m.name, { name: m.name, store: false })
    }
  }
  collectWardrobe(sample)
  collectStoreNames(sample)

  const writeWardrobe = () => {
    const outfits = [...wOut.values()].sort((a, b) => a.name.localeCompare(b.name))
    const mounts = [...wMnt.values()].sort((a, b) => a.name.localeCompare(b.name))
    fs.writeFileSync(wardrobeFile, JSON.stringify({ outfits, mounts }, null, 0))
  }

  // Re-busca também entradas antigas salvas sem outfits ou sem bosstiary.
  // REFRESH=1 (ou --refresh) força re-buscar quem ainda não tem os campos de
  // store mais novos (ex.: gpActive/gpPoints), sem precisar apagar o arquivo.
  const REFRESH = process.env.REFRESH === '1' || process.argv.includes('--refresh')
  const pending = auctions.filter(
    a =>
      !byId[a.id] ||
      byId[a.id].outfits === undefined ||
      byId[a.id].bosstiary === undefined ||
      (REFRESH && byId[a.id].extra?.gpActive === undefined),
  )
  console.log(
    `📋 ${auctions.length} leilões | ${Object.keys(byId).length} já salvos | ${pending.length} a (re)buscar` +
      (REFRESH ? ' (REFRESH: incluindo quem falta gpActive)' : ''),
  )

  let ok = 0
  let fail = 0
  let processed = 0
  for (const a of pending) {
    const body = await fetchDetail(a.id)
    const parsed = extractExtra(body)
    if (parsed) {
      byId[a.id] = parsed
      collectWardrobe(body)
      collectStoreNames(body)
      ok++
    } else fail++
    processed++
    if (processed % 25 === 0) {
      process.stdout.write(`\r🔎 novos ok: ${ok} | falhas: ${fail} | ${processed}/${pending.length}`)
      // salva progresso parcial para não perder em caso de interrupção
      fs.writeFileSync(OUT_FILE, JSON.stringify({ enrichedAt: new Date().toISOString(), byId }, null, 2))
      writeWardrobe()
      writeStoreNames()
    }
    await sleep(DELAY_MS)
  }
  writeWardrobe()

  fs.writeFileSync(OUT_FILE, JSON.stringify({ enrichedAt: new Date().toISOString(), byId }, null, 2))
  writeStoreNames()
  console.log(`\n✅ Total salvo: ${Object.keys(byId).length} (novos: ${ok}, ainda faltando: ${fail})`)
  if (fail > 0) console.log('   Rode novamente para tentar os que faltaram (retoma de onde parou).')
  console.log(
    `🧪 Diagnóstico de itens de store: ${storeCharsScanned} personagens escaneados → output/storeItemNames.json` +
      `\n   (a lista "watchlist" confirma quais itens-alvo aparecem no RubinOT; ` +
      `só cobre os leilões buscados nesta rodada)`,
  )

  await browser.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
