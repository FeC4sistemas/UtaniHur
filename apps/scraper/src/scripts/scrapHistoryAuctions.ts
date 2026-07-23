import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import fs from 'fs'
import path from 'path'
import { AuctionListItem, AuctionListResponse } from '../types/auction'

puppeteer.use(StealthPlugin())

const BASE_URL = 'https://rubinot.com.br/api/bazaar/history'
const OUTPUT_FILE = path.resolve(__dirname, '../../output/HistoryAuctions.jsonl')
const DELAY_MS = 800

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function scrapHistoryAuctions() {
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

  // Lê IDs já salvos para não duplicar
  const existingIds = new Set<number>()
  if (fs.existsSync(OUTPUT_FILE)) {
    const lines = fs.readFileSync(OUTPUT_FILE, 'utf-8').split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const auction = JSON.parse(line)
        existingIds.add(auction.id)
      } catch {}
    }
    console.log(`📂 ${existingIds.size} auções já no histórico`)
  }

  async function fetchPage(pageNum: number): Promise<AuctionListResponse> {
    const url = `${BASE_URL}?page=${pageNum}&limit=25&sortBy=auction_end&sortOrder=desc`
    const result = await page.evaluate(async (fetchUrl: string) => {
      const res = await fetch(fetchUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    }, url)
    return result as AuctionListResponse
  }

  const firstPage = await fetchPage(1)
  const { totalPages, total } = firstPage.pagination
  console.log(`📊 Total no histórico: ${total} | ${totalPages} páginas`)

  const stream = fs.createWriteStream(OUTPUT_FILE, { flags: 'a' })
  let newCount = 0

  const processPage = (auctions: AuctionListItem[]) => {
    for (const auction of auctions) {
      if (!existingIds.has(auction.id)) {
        stream.write(JSON.stringify(auction) + '\n')
        existingIds.add(auction.id)
        newCount++
      }
    }
  }

  processPage(firstPage.auctions)

  for (let p = 2; p <= totalPages; p++) {
    process.stdout.write(`\r⏳ Página ${p}/${totalPages} | Novos: ${newCount}`)
    await sleep(DELAY_MS)
    const data = await fetchPage(p)
    processPage(data.auctions)
  }

  stream.end()
  console.log(`\n✅ ${newCount} novas auções adicionadas ao histórico`)
  await browser.close()
}

scrapHistoryAuctions().catch(console.error)