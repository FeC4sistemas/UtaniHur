/*
  DIAGNÓSTICO da aba "Quests" do detalhe do personagem no RubinOT.

  O /api/bazaar/{id} não retorna uma lista de quests — a aba "Quests" do site
  é calculada no navegador a partir das storages. Este script abre a página de
  um personagem, clica na aba "Quests" e captura como o site marca feito/não
  feito, para eu implementar a leitura correta.

  Saída: output/questsSample.json (linhas capturadas + HTML + rede) e
         output/questsSample.png (screenshot da aba)

  Uso: npm run quests:sample [id]   (id opcional; padrão = 1º leilão)
*/
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import fs from 'fs'
import path from 'path'

puppeteer.use(StealthPlugin())

const CURRENT_FILE = path.resolve(__dirname, '../../output/CurrentAuctions.json')
const OUT_FILE = path.resolve(__dirname, '../../output/questsSample.json')
const SHOT_FILE = path.resolve(__dirname, '../../output/questsSample.png')
const MAIN_ORIGIN = 'https://rubinot.com.br'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function main() {
  const data = JSON.parse(fs.readFileSync(CURRENT_FILE, 'utf-8'))
  // usa o id passado por argumento ou o personagem de maior level (mais quests feitas)
  const argId = process.argv[2] ? Number(process.argv[2]) : null
  const ref = argId
    ? data.auctions.find((a: any) => a.id === argId) ?? data.auctions[0]
    : [...data.auctions].sort((a: any, b: any) => b.level - a.level)[0]
  console.log(`🎯 Personagem de referência: ${ref.name} (id ${ref.id}, level ${ref.level})`)

  console.log('🚀 Iniciando navegador com stealth...')
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null,
  })
  const page = await browser.newPage()

  const network: Array<{ url: string; body: string }> = []
  page.on('response', async (res: any) => {
    const ct = res.headers()['content-type'] || ''
    if (!ct.includes('application/json')) return
    const url = res.url()
    if (/geo-language|maintenance|auth\/session|boosted|worlds/.test(url)) return
    try {
      const t = await res.text()
      if (t.length < 100000) network.push({ url, body: t.slice(0, 6000) })
    } catch {
      /* ignora */
    }
  })

  console.log('🌐 Abrindo a página do personagem...')
  await page.goto(`${MAIN_ORIGIN}/bazaar/${ref.id}`, { waitUntil: 'networkidle0', timeout: 60000 })
  console.log('⏳ Aguardando Cloudflare...')
  await sleep(8000)

  // Clica na aba "Quests"
  const clicked = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('button, a, [role="tab"], div, span'))
    const tab = els.find(e => e.textContent?.trim() === 'Quests' && e.offsetParent !== null)
    if (tab) {
      tab.click()
      return true
    }
    return false
  })
  console.log(`🖱️  Aba Quests clicada: ${clicked}`)
  await sleep(2500)

  // Captura as linhas da tabela de quests (nome + qualquer marcador de status)
  const rows = await page.evaluate(() => {
    // procura o container que tem o cabeçalho "Quest" e "Status"
    const all = Array.from(document.querySelectorAll<HTMLElement>('table, ul, div'))
    const container =
      all.find(el => /status/i.test(el.textContent ?? '') && /quest/i.test(el.textContent ?? '') && el.querySelectorAll('*').length < 400) ??
      document.body
    const out: Array<{ text: string; html: string }> = []
    // pega elementos "linha" plausíveis
    container.querySelectorAll<HTMLElement>('tr, li, [class*="row"], [class*="Row"]').forEach(r => {
      const text = (r.textContent ?? '').trim().replace(/\s+/g, ' ')
      if (text && text.length < 120) out.push({ text, html: r.outerHTML.slice(0, 600) })
    })
    return { containerHtml: container.outerHTML.slice(0, 8000), rows: out.slice(0, 60) }
  })

  fs.writeFileSync(
    OUT_FILE,
    JSON.stringify({ collectedAt: new Date().toISOString(), refId: ref.id, tabClicked: clicked, network, ...rows }, null, 2),
  )
  await page.screenshot({ path: SHOT_FILE, fullPage: true }).catch(() => {})
  console.log(`✅ Diagnóstico salvo em output/questsSample.json e questsSample.png`)
  console.log('   Me mande esses arquivos para eu ler o status real das quests.')

  await browser.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
