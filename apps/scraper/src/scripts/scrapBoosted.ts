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

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Remove prefixos como "Boosted Boss:" / "Boosted Creature:" e espaços. */
function cleanName(raw: string): string {
  return raw
    .replace(/boosted\s+(boss|creature|monster)\s*[:\-]?/i, '')
    .replace(/\s+/g, ' ')
    .trim()
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

  // Coleta TODOS os candidatos rotulados no DOM. Os rótulos "Boosted Boss:"
  // e "Boosted Creature:" são inequívocos — usamos o texto ao redor para
  // separar corretamente boss de criatura.
  const hits: Array<{ kind: 'boss' | 'creature'; name: string; from: string }> = await page.evaluate(() => {
    const out: Array<{ kind: 'boss' | 'creature'; name: string; from: string }> = []
    const seen = new Set<string>()
    document.querySelectorAll<HTMLElement>('img, [title], [alt]').forEach(el => {
      // Considera alt/title do próprio elemento e o title do pai (comum em cards)
      const texts = [
        el.getAttribute('alt') ?? '',
        el.getAttribute('title') ?? '',
        el.parentElement?.getAttribute('title') ?? '',
        el.parentElement?.textContent ?? '',
      ]
      for (const t of texts) {
        const m = t.match(/boosted\s+(boss|creature|monster)\s*[:\-]?\s*([^\n|<>]{2,40})/i)
        if (m) {
          const kind = /boss/i.test(m[1]) ? 'boss' : 'creature'
          const name = m[2].trim()
          const key = `${kind}:${name}`
          if (name && !seen.has(key)) {
            seen.add(key)
            out.push({ kind, name, from: t.slice(0, 80) })
          }
        }
      }
    })
    return out
  })

  const bossHit = hits.find(h => h.kind === 'boss')
  const creatureHit = hits.find(h => h.kind === 'creature')
  const boss = bossHit ? { name: cleanName(bossHit.name) } : null
  const creature = creatureHit ? { name: cleanName(creatureHit.name) } : null

  const isoDate = new Date().toISOString().slice(0, 10)

  // Diagnóstico sempre gravado — se boss/criatura vierem errados, me mande este arquivo
  fs.writeFileSync(
    REPORT_FILE,
    JSON.stringify({ collectedAt: new Date().toISOString(), hits, network }, null, 2),
  )

  if (boss || creature) {
    fs.writeFileSync(OUT_FILE, JSON.stringify({ boss, creature, date: isoDate }, null, 2))
    console.log(`✅ Boost do dia salvo: boss=${boss?.name ?? '—'} | criatura=${creature?.name ?? '—'}`)
    console.log('ℹ️  Se algo veio errado, me mande output/boostedSources.json')
  } else {
    console.log('⚠️  Não encontrei o boost. Diagnóstico salvo em output/boostedSources.json — me mande esse arquivo.')
  }

  await browser.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
