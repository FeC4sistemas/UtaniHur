/*
  DIAGNÓSTICO do detalhe do leilão do RubinOT.

  A rota de detalhe não é conhecida, então este passo apenas COLETA material
  bruto para identificá-la: abre o bazaar, registra todas as respostas JSON/XHR,
  tenta abrir o primeiro leilão (clique + navegação), sonda rotas candidatas e
  grava tudo em output/auctionDetailSample.json.

  Rode e me mande esse arquivo — com ele eu descubro a rota certa e finalizo
  o enriquecimento (imbuements, prey, gems, etc.).

  Uso: npm run details   (na raiz do monorepo)
*/
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import fs from 'fs'
import path from 'path'

puppeteer.use(StealthPlugin())

const CURRENT_FILE = path.resolve(__dirname, '../../output/CurrentAuctions.json')
const SAMPLE_FILE = path.resolve(__dirname, '../../output/auctionDetailSample.json')
const MAIN_ORIGIN = 'https://rubinot.com.br'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const preview = (v: any) => {
  try {
    const s = typeof v === 'string' ? v : JSON.stringify(v)
    return s.length > 4000 ? s.slice(0, 4000) + '…(truncado)' : s
  } catch {
    return String(v)
  }
}

async function main() {
  const data = JSON.parse(fs.readFileSync(CURRENT_FILE, 'utf-8'))
  const first = data.auctions?.[0]
  const firstId = first?.id
  console.log(`🎯 Leilão de referência: id=${firstId} (${first?.name})`)

  console.log('🚀 Iniciando navegador com stealth...')
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: puppeteer.executablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null,
  })
  const page = await browser.newPage()

  // Registra toda resposta JSON/XHR
  const captured: Array<{ phase: string; url: string; status: number; body: string }> = []
  let phase = 'load'
  page.on('response', async (res: any) => {
    const ct = res.headers()['content-type'] || ''
    if (!/json|javascript|text\/plain/.test(ct)) return
    const url = res.url()
    if (/\.(js|css|woff|png|gif|jpg|svg)(\?|$)/i.test(url)) return
    try {
      const text = await res.text()
      if (text && text.trim().startsWith('{') && text.length < 200000) {
        captured.push({ phase, url, status: res.status(), body: preview(text) })
      }
    } catch {
      /* ignora */
    }
  })

  console.log('🌐 Abrindo rubinot.com.br/bazaar...')
  await page.goto(`${MAIN_ORIGIN}/bazaar`, { waitUntil: 'networkidle0', timeout: 60000 })
  console.log('⏳ Aguardando Cloudflare...')
  await sleep(8000)

  // Fase: tenta abrir o primeiro leilão clicando no card
  phase = 'click'
  const clicked = await page
    .evaluate(async (id: number) => {
      const clickable = Array.from(
        document.querySelectorAll<HTMLElement>('a, [role="button"], button, [class*="auction"], [class*="card"]'),
      )
      // procura algo que referencie o id ou pareça um card clicável
      const byId = clickable.find(el => (el.getAttribute('href') || '').includes(String(id)))
      const target = byId || clickable.find(el => /auction|card|character/i.test(el.className))
      if (target) {
        target.click()
        return target.outerHTML.slice(0, 200)
      }
      return null
    }, firstId)
    .catch(() => null)
  await sleep(4000)

  // Fase: navega direto para a URL do leilão (várias formas)
  phase = 'nav'
  for (const url of [`${MAIN_ORIGIN}/bazaar?auction=${firstId}`, `${MAIN_ORIGIN}/bazaar/${firstId}`]) {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 }).catch(() => {})
    await sleep(3000)
  }

  // Fase: sonda rotas candidatas via fetch na página
  phase = 'probe'
  const candidates = [
    `${MAIN_ORIGIN}/api/bazaar/${firstId}`,
    `${MAIN_ORIGIN}/api/bazaar/auction/${firstId}`,
    `${MAIN_ORIGIN}/api/bazaar/character/${firstId}`,
    `${MAIN_ORIGIN}/api/bazaar?auction=${firstId}`,
    `${MAIN_ORIGIN}/api/auction/${firstId}`,
    `${MAIN_ORIGIN}/api/bazaar/details/${firstId}`,
  ]
  const probes: Array<{ url: string; status: number; body: string }> = []
  for (const url of candidates) {
    const r = await page
      .evaluate(async (u: string) => {
        try {
          const res = await fetch(u)
          return { status: res.status, body: (await res.text()).slice(0, 4000) }
        } catch (e: any) {
          return { status: 0, body: 'ERR ' + e.message }
        }
      }, url)
      .catch(() => ({ status: -1, body: 'evaluate failed' }))
    probes.push({ url, ...r })
  }

  const currentUrl = page.url()
  fs.writeFileSync(
    SAMPLE_FILE,
    JSON.stringify(
      {
        collectedAt: new Date().toISOString(),
        referenceAuctionId: firstId,
        finalUrl: currentUrl,
        clickedElement: clicked,
        listItemSample: first,
        candidateProbes: probes,
        capturedResponses: captured.slice(0, 60),
      },
      null,
      2,
    ),
  )
  console.log(`\n✅ Diagnóstico salvo em output/auctionDetailSample.json`)
  console.log(`   Respostas JSON capturadas: ${captured.length} | sondas: ${probes.length}`)
  console.log('   Me mande esse arquivo para eu identificar a rota do detalhe.')

  await browser.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
