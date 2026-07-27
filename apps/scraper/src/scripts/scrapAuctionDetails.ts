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
const DELAY_MS = 200

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const num = (v: any): number | undefined => (typeof v === 'number' ? v : undefined)
const bool = (v: any): boolean | undefined => (typeof v === 'boolean' ? v : undefined)

function extractExtra(general: any) {
  if (!general) return null
  const s = general.skills ?? {}
  return {
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

  const fetchDetail = (id: number) =>
    page.evaluate(async (u: string) => {
      try {
        const res = await fetch(u)
        return res.ok ? await res.json() : null
      } catch {
        return null
      }
    }, `${MAIN_ORIGIN}/api/bazaar/${id}`)

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

  const byId: Record<number, any> = {}
  let ok = 0
  let fail = 0
  for (const a of auctions) {
    const body = await fetchDetail(a.id)
    const parsed = extractExtra(body?.general)
    if (parsed) {
      byId[a.id] = parsed
      ok++
    } else fail++
    if ((ok + fail) % 25 === 0) process.stdout.write(`\r🔎 detalhes — ok: ${ok} | falhas: ${fail} | ${ok + fail}/${auctions.length}`)
    await sleep(DELAY_MS)
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify({ enrichedAt: new Date().toISOString(), byId }, null, 2))
  console.log(`\n✅ ${ok} detalhes salvos em AuctionDetails.json (${fail} falhas)`)

  await browser.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
