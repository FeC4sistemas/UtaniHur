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
  return {
    outfits,
    mounts,
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
    },
  }
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
    executablePath: puppeteer.executablePath(),
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

  // Re-busca também entradas antigas que foram salvas sem a posse de outfits
  const pending = auctions.filter(a => !byId[a.id] || byId[a.id].outfits === undefined)
  console.log(`📋 ${auctions.length} leilões | ${Object.keys(byId).length} já salvos | ${pending.length} a (re)buscar`)

  let ok = 0
  let fail = 0
  let processed = 0
  for (const a of pending) {
    const body = await fetchDetail(a.id)
    const parsed = extractExtra(body)
    if (parsed) {
      byId[a.id] = parsed
      ok++
    } else fail++
    processed++
    if (processed % 25 === 0) {
      process.stdout.write(`\r🔎 novos ok: ${ok} | falhas: ${fail} | ${processed}/${pending.length}`)
      // salva progresso parcial para não perder em caso de interrupção
      fs.writeFileSync(OUT_FILE, JSON.stringify({ enrichedAt: new Date().toISOString(), byId }, null, 2))
    }
    await sleep(DELAY_MS)
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify({ enrichedAt: new Date().toISOString(), byId }, null, 2))
  console.log(`\n✅ Total salvo: ${Object.keys(byId).length} (novos: ${ok}, ainda faltando: ${fail})`)
  if (fail > 0) console.log('   Rode novamente para tentar os que faltaram (retoma de onde parou).')

  await browser.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
