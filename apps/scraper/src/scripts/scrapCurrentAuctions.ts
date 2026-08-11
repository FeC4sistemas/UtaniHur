import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import fs from 'fs'
import path from 'path'
import { AuctionListItem, AuctionListResponse } from '../types/auction'

puppeteer.use(StealthPlugin())

const BASE_URL = 'https://rubinot.com.br/api/bazaar'
const OUTPUT_FILE = path.resolve(__dirname, '../../output/CurrentAuctions.json')
const DELAY_MS = 1200        // pausa base entre páginas (era 800; subiu p/ evitar 429)
const MAX_RETRIES = 5        // tentativas em caso de 429/5xx

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function scrapCurrentAuctions() {
  console.log('🚀 Iniciando navegador com stealth...')

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null
  })

  const page = await browser.newPage()

  console.log('🌐 Abrindo rubinot.com.br/bazaar...')
  await page.goto('https://rubinot.com.br/bazaar', {
    waitUntil: 'networkidle0',
    timeout: 60000
  })

  console.log('⏳ Aguardando Cloudflare...')
  await sleep(8000)

  const title = await page.title()
  console.log(`📄 Título: ${title}`)

  const testResult = await page.evaluate(async (url: string) => {
    try {
      const res = await fetch(url)
      const text = await res.text()
      return { status: res.status, body: text.substring(0, 200) }
    } catch (e: any) {
      return { status: 0, body: e.message }
    }
  }, `${BASE_URL}?page=1&limit=25`)

  console.log(`Status: ${testResult.status}`)
  console.log(`Body: ${testResult.body}`)

  if (testResult.status !== 200) {
    console.log('❌ API ainda bloqueada.')
    await browser.close()
    return
  }

  async function fetchPage(pageNum: number, attempt = 0): Promise<AuctionListResponse> {
    const url = `${BASE_URL}?page=${pageNum}&limit=25&sortBy=auction_end&sortOrder=asc`
    const result = await page.evaluate(async (fetchUrl: string) => {
      try {
        const res = await fetch(fetchUrl)
        return { ok: res.ok, status: res.status, data: res.ok ? await res.json() : null }
      } catch (e: any) {
        return { ok: false, status: 0, data: null, error: e.message }
      }
    }, url)

    if (!result.ok) {
      // 429 (throttle) e 5xx: espera crescente e tenta de novo (3s,6s,12s,24s,48s)
      if ((result.status === 429 || result.status >= 500 || result.status === 0) && attempt < MAX_RETRIES) {
        const wait = 3000 * Math.pow(2, attempt)
        process.stdout.write(
          `\n⚠️  HTTP ${result.status} na página ${pageNum} — aguardando ${wait / 1000}s e tentando de novo (${attempt + 1}/${MAX_RETRIES})...\n`,
        )
        await sleep(wait)
        return fetchPage(pageNum, attempt + 1)
      }
      throw new Error(`HTTP ${result.status} na página ${pageNum} (sem mais tentativas)`)
    }
    return result.data as AuctionListResponse
  }

  const allAuctions: AuctionListItem[] = []
  const firstPage = await fetchPage(1)
  const { totalPages, total } = firstPage.pagination
  console.log(`📊 Total: ${total} auções | ${totalPages} páginas`)
  allAuctions.push(...firstPage.auctions)

  for (let p = 2; p <= totalPages; p++) {
    process.stdout.write(`\r⏳ Página ${p}/${totalPages}...`)
    await sleep(DELAY_MS)
    const data = await fetchPage(p)
    allAuctions.push(...data.auctions)
  }

  const result = {
    scrapedAt: new Date().toISOString(),
    total: allAuctions.length,
    auctions: allAuctions,
  }

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true })
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf-8')

  console.log(`\n✅ ${allAuctions.length} auções salvas em CurrentAuctions.json`)
  await browser.close()
}

scrapCurrentAuctions().catch(console.error)