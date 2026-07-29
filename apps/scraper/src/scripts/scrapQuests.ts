/*
  Lê as QUESTS concluídas de cada personagem, direto da aba "Quests" da página
  de detalhe (o site marca feito = ícone de check verde; não feito = círculo).

  Saída: output/AuctionQuests.json = { byId: { [id]: string[] }, allQuests: string[] }

  Uso: npm run quests   (na raiz do monorepo; idempotente/retomável)

  Obs.: abre a página de cada personagem (mais lento que a API). Pode rodar em
  partes — retoma de onde parou.
*/
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import fs from 'fs'
import path from 'path'

puppeteer.use(StealthPlugin())

const CURRENT_FILE = path.resolve(__dirname, '../../output/CurrentAuctions.json')
const OUT_FILE = path.resolve(__dirname, '../../output/AuctionQuests.json')
const MAIN_ORIGIN = 'https://rubinot.com.br'
const DELAY_MS = 150

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function main() {
  const data = JSON.parse(fs.readFileSync(CURRENT_FILE, 'utf-8'))
  const auctions: any[] = data.auctions ?? []

  let byId: Record<number, string[]> = {}
  const allQuests = new Set<string>()
  if (fs.existsSync(OUT_FILE)) {
    try {
      const prev = JSON.parse(fs.readFileSync(OUT_FILE, 'utf-8'))
      byId = prev.byId ?? {}
      for (const qn of prev.allQuests ?? []) allQuests.add(qn)
    } catch {
      /* recomeça */
    }
  }

  console.log('🚀 Iniciando navegador com stealth...')
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: puppeteer.executablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null,
  })
  const page = await browser.newPage()

  console.log('🌐 Abrindo rubinot.com.br/bazaar (Cloudflare)...')
  await page.goto(`${MAIN_ORIGIN}/bazaar`, { waitUntil: 'networkidle0', timeout: 60000 })
  await sleep(8000)

  const readQuests = () =>
    page.evaluate(async () => {
      // clica na aba "Quests"
      const tab = Array.from(document.querySelectorAll<HTMLElement>('button, a, [role="tab"], div, span')).find(
        e => e.textContent?.trim() === 'Quests' && (e as HTMLElement).offsetParent !== null,
      )
      tab?.click()
      await new Promise(r => setTimeout(r, 900))
      // expande a lista ("mostrar mais") se existir
      const more = Array.from(document.querySelectorAll<HTMLElement>('button, a, span')).find(e =>
        /mostrar mais|show more|ver mais/i.test(e.textContent ?? ''),
      )
      if (more) {
        more.click()
        await new Promise(r => setTimeout(r, 500))
      }
      // acha a tabela de quests
      const table = Array.from(document.querySelectorAll('table')).find(
        t => /quest/i.test(t.textContent ?? '') && /status/i.test(t.textContent ?? ''),
      )
      if (!table) return null
      const done: string[] = []
      const all: string[] = []
      table.querySelectorAll('tr').forEach(tr => {
        const tds = tr.querySelectorAll('td')
        if (tds.length < 2) return
        const name = (tds[1].textContent ?? '').trim()
        if (!name) return
        all.push(name)
        if (tds[0].querySelector('svg')) done.push(name) // check verde = feita
      })
      return { done, all }
    })

  const pending = auctions.filter(a => byId[a.id] === undefined)
  console.log(`📋 ${auctions.length} leilões | ${Object.keys(byId).length} já lidos | ${pending.length} a ler`)

  let ok = 0
  let processed = 0
  for (const a of pending) {
    await page.goto(`${MAIN_ORIGIN}/bazaar/${a.id}`, { waitUntil: 'networkidle0', timeout: 45000 }).catch(() => {})
    await sleep(700)
    const res = await readQuests().catch(() => null)
    if (res) {
      byId[a.id] = res.done
      res.all.forEach((q: string) => allQuests.add(q))
      ok++
    } else {
      byId[a.id] = [] // marca como lido p/ não travar o resume
    }
    processed++
    if (processed % 20 === 0) {
      process.stdout.write(`\r📖 lidos: ${ok} | ${processed}/${pending.length} | quests distintas: ${allQuests.size}`)
      fs.writeFileSync(OUT_FILE, JSON.stringify({ byId, allQuests: [...allQuests].sort() }, null, 0))
    }
    await sleep(DELAY_MS)
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify({ byId, allQuests: [...allQuests].sort() }, null, 0))
  console.log(`\n✅ Quests lidas: ${Object.keys(byId).length} personagens | ${allQuests.size} quests distintas`)

  await browser.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
