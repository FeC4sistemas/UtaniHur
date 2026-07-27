/*
  Enriquece os leilões com o DETALHE de cada um (a listagem traz só os
  destaques principais; o detalhe costuma trazer a lista completa —
  imbuements, prey, gems, animus, etc. — normalmente como "augments").

  Como a rota exata do detalhe pode variar, o script:
  1. Abre o bazaar, passa pela Cloudflare.
  2. Descobre a rota do detalhe: testa rotas prováveis e também intercepta o
     tráfego ao abrir um leilão, procurando um JSON com lookType + mais
     augments que a listagem.
  3. Para cada leilão, busca o detalhe e guarda a lista completa de augments
     (e quaisquer pares "Rótulo: valor") em output/AuctionDetails.json.
  4. SEMPRE grava output/auctionDetailSample.json com o detalhe cru do 1º
     leilão — me mande esse arquivo para eu mapear campos específicos.

  Uso: npm run details   (na raiz do monorepo; idempotente)
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
const DELAY_MS = 250

const DETAIL_CANDIDATES = [
  `${MAIN_ORIGIN}/api/bazaar/{id}`,
  `${MAIN_ORIGIN}/api/bazaar/auction/{id}`,
  `${MAIN_ORIGIN}/api/bazaar/character/{id}`,
  `${MAIN_ORIGIN}/api/bazaar?auction={id}`,
  `${MAIN_ORIGIN}/api/auction/{id}`,
]

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const fetchJson = (page: any, url: string) =>
  page.evaluate(async (u: string) => {
    try {
      const res = await fetch(u)
      return res.ok ? await res.json() : null
    } catch {
      return null
    }
  }, url)

const unwrap = (body: any) => body?.auction ?? body?.data ?? body

/** Converte um augment em par {label, value} quando faz sentido. */
function toDetail(text: string): { label: string; value: string } | null {
  const colon = text.match(/^(.{2,40}?):\s*(.+)$/)
  if (colon) return { label: colon[1].trim(), value: colon[2].trim() }
  const lead = text.match(/^(\d[\d.,/]*)\s+(.{2,40})$/)
  if (lead) return { label: lead[2].trim(), value: lead[1].trim() }
  return null
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

  const detailResponses: Array<{ url: string; body: any }> = []
  page.on('response', async (res: any) => {
    const ct = res.headers()['content-type'] || ''
    if (!ct.includes('application/json')) return
    try {
      const body = await res.json()
      const d = unwrap(body)
      if (d && typeof d.lookType === 'number' && Array.isArray(d.highlightAugments)) {
        detailResponses.push({ url: res.url(), body })
      }
    } catch {
      /* ignora */
    }
  })

  console.log('🌐 Abrindo rubinot.com.br/bazaar...')
  await page.goto(`${MAIN_ORIGIN}/bazaar`, { waitUntil: 'networkidle0', timeout: 60000 })
  console.log('⏳ Aguardando Cloudflare...')
  await sleep(8000)

  const listAugCount = (auctions[0].highlightAugments ?? []).length
  const first = auctions[0].id

  // 1) tenta rotas candidatas
  let template: string | null = null
  for (const cand of DETAIL_CANDIDATES) {
    const body = await fetchJson(page, cand.replace('{id}', String(first)))
    const d = unwrap(body)
    if (d && typeof d.lookType === 'number' && Array.isArray(d.highlightAugments)) {
      template = cand
      fs.writeFileSync(SAMPLE_FILE, JSON.stringify({ url: cand, body }, null, 2))
      break
    }
  }

  // 2) plano B: abre a página do leilão e captura o detalhe interceptado
  if (!template) {
    await page.goto(`${MAIN_ORIGIN}/bazaar?auction=${first}`, { waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {})
    await sleep(4000)
    const hit = detailResponses.find(r => JSON.stringify(r.body).includes(`"id":${first}`)) ?? detailResponses[0]
    if (hit) {
      fs.writeFileSync(SAMPLE_FILE, JSON.stringify(hit, null, 2))
      // tenta derivar um template trocando o id na URL
      if (hit.url.includes(String(first))) template = hit.url.replace(String(first), '{id}')
    }
  }

  if (!template) {
    console.log('⚠️  Não achei a rota de detalhe. Se um auctionDetailSample.json foi gerado, me mande.')
    console.log('    Senão, me diga e eu tento outra abordagem.')
    await browser.close()
    return
  }
  console.log(`📐 Rota de detalhe: ${template}`)

  // 3) enriquece todos
  const enrichment: Record<number, { highlightAugments: any[]; details: Array<{ label: string; value: string }> }> = {}
  let ok = 0
  let fail = 0
  for (const a of auctions) {
    const body = await fetchJson(page, template.replace('{id}', String(a.id)))
    const d = unwrap(body)
    if (d && Array.isArray(d.highlightAugments)) {
      const augs = d.highlightAugments
      const details = augs
        .map((x: any) => toDetail(String(x.text ?? '')))
        .filter(Boolean) as Array<{ label: string; value: string }>
      enrichment[a.id] = { highlightAugments: augs, details }
      ok++
    } else fail++
    if (ok % 25 === 0 || fail % 25 === 0) process.stdout.write(`\r🔎 detalhes — ok: ${ok} | falhas: ${fail}`)
    await sleep(DELAY_MS)
  }
  console.log(`\n💾 Salvando ${Object.keys(enrichment).length} detalhes...`)
  fs.writeFileSync(OUT_FILE, JSON.stringify({ enrichedAt: new Date().toISOString(), byId: enrichment }, null, 2))
  console.log('✅ Concluído. Se algum campo faltar/vier errado, me mande output/auctionDetailSample.json')

  await browser.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
