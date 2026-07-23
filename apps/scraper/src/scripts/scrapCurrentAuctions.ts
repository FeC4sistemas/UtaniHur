import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import fs from 'fs'
import path from 'path'
import { AuctionListItem, AuctionListResponse } from '../types/auction'

puppeteer.use(StealthPlugin())

const BASE_URL = 'https://rubinot.com.br/api/bazaar'
const OUTPUT_FILE = path.resolve(__dirname, '../../output/CurrentAuctions.json')
const DELAY_MS = 800

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function scrapCurrentAuctions() {
  console.log('🚀 Iniciando navegador com stealth...')

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: puppeteer.executablePath(),
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

  async function fetchPage(pageNum: number): Promise<AuctionListResponse> {
    const url = `${BASE_URL}?page=${pageNum}&limit=25&sortBy=auction_end&sortOrder=asc`
    const result = await page.evaluate(async (fetchUrl: string) => {
      const res = await fetch(fetchUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    }, url)
    return result as AuctionListResponse
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