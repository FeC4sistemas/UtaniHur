/*
  Coleta o boss e a criatura em boost do dia no RubinOT.

  O site expõe essa informação na home / numa API. Como o endpoint exato
  pode variar, o script:
  1. Tenta rotas de API prováveis (JSON).
  2. Se falhar, procura na home imagens/textos com marcadores de "boosted".
  3. Salva em output/Boosted.json no formato consumido por /api/boosted.
     Se nada for encontrado, grava output/boostedSources.json com o que viu
     na página para diagnóstico.

  Uso: npm run boosted   (na raiz do monorepo)
*/
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import fs from 'fs'
import path from 'path'

puppeteer.use(StealthPlugin())

const OUT_FILE = path.resolve(__dirname, '../../output/Boosted.json')
const REPORT_FILE = path.resolve(__dirname, '../../output/boostedSources.json')
const MAIN_ORIGIN = 'https://rubinot.com.br'

const API_CANDIDATES = [
  `${MAIN_ORIGIN}/api/boostedcreature`,
  `${MAIN_ORIGIN}/api/boosted`,
  `${MAIN_ORIGIN}/api/boostedboss`,
  `${MAIN_ORIGIN}/api/server/boosted`,
]

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Extrai {name} de um objeto de API tolerando formatos diferentes. */
function pickName(obj: any): string | null {
  if (!obj || typeof obj !== 'object') return null
  return obj.name ?? obj.boss?.name ?? obj.creature?.name ?? obj.raceName ?? null
}

async function main() {
  console.log('🚀 Iniciando navegador com stealth...')
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: puppeteer.executablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null,
  })
  const page = await browser.newPage()

  const network: Array<{ url: string; type: string }> = []
  page.on('response', (res: any) => {
    const url = res.url()
    if (!url.startsWith('data:') && !url.startsWith('blob:')) {
      network.push({ url, type: res.headers()['content-type'] || '' })
    }
  })

  console.log(`🌐 Abrindo ${MAIN_ORIGIN}...`)
  await page.goto(MAIN_ORIGIN, { waitUntil: 'networkidle0', timeout: 60000 })
  console.log('⏳ Aguardando Cloudflare...')
  await sleep(8000)

  let boss: { name: string } | null = null
  let creature: { name: string } | null = null

  // 1. Rotas de API
  for (const url of API_CANDIDATES) {
    const body = await page.evaluate(async (u: string) => {
      try {
        const res = await fetch(u)
        return res.ok ? await res.json() : null
      } catch {
        return null
      }
    }, url)
    if (body) {
      const name = pickName(body)
      if (name && /boss/i.test(url) && !boss) boss = { name }
      else if (name && !creature) creature = { name }
    }
  }

  // 2. Heurística no DOM (elementos com "boost" no alt/title/texto próximo)
  if (!boss || !creature) {
    const found = await page.evaluate(() => {
      const hits: Array<{ kind: string; name: string }> = []
      document.querySelectorAll<HTMLElement>('*').forEach(el => {
        const label = `${el.getAttribute('alt') ?? ''} ${el.getAttribute('title') ?? ''}`.toLowerCase()
        if (label.includes('boost')) {
          const name = (el.getAttribute('alt') || el.getAttribute('title') || el.textContent || '').trim()
          if (name) hits.push({ kind: label.includes('boss') ? 'boss' : 'creature', name })
        }
      })
      return hits
    })
    for (const h of found) {
      if (h.kind === 'boss' && !boss) boss = { name: h.name }
      if (h.kind === 'creature' && !creature) creature = { name: h.name }
    }
  }

  const isoDate = new Date().toISOString().slice(0, 10)

  if (boss || creature) {
    fs.writeFileSync(OUT_FILE, JSON.stringify({ boss, creature, date: isoDate }, null, 2))
    console.log(`✅ Boost do dia salvo: boss=${boss?.name ?? '—'} | criatura=${creature?.name ?? '—'}`)
  } else {
    fs.writeFileSync(REPORT_FILE, JSON.stringify({ collectedAt: new Date().toISOString(), network }, null, 2))
    console.log('⚠️  Não encontrei o boost. Tráfego salvo em output/boostedSources.json — me mande esse arquivo.')
  }

  await browser.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
