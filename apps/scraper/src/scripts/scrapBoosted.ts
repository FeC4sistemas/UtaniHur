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
const SPRITE_DIR = path.resolve(__dirname, '../../../web/public/sprites')
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

  // Coleta os candidatos rotulados no DOM. Os rótulos "Boosted Boss:" e
  // "Boosted Creature:" são inequívocos; capturamos também a imagem associada
  // (o próprio elemento se for <img>, ou a <img> mais próxima).
  const hits: Array<{ kind: 'boss' | 'creature'; name: string; src: string; from: string }> =
    await page.evaluate(() => {
      const out: Array<{ kind: 'boss' | 'creature'; name: string; src: string; from: string }> = []
      const seen = new Set<string>()
      const nearestImg = (el: HTMLElement): string => {
        const self = el as HTMLImageElement
        if (self.tagName === 'IMG' && self.src) return self.src
        const inside = el.querySelector('img') as HTMLImageElement | null
        if (inside?.src) return inside.src
        const parentImg = el.parentElement?.querySelector('img') as HTMLImageElement | null
        return parentImg?.src ?? ''
      }
      document.querySelectorAll<HTMLElement>('img, [title], [alt]').forEach(el => {
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
              out.push({ kind, name, src: nearestImg(el), from: t.slice(0, 80) })
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

  // Baixa a imagem exata que o site mostra (abre uma aba na origem da imagem
  // para evitar CORS) e salva com nome fixo consumido pelo widget.
  fs.mkdirSync(SPRITE_DIR, { recursive: true })
  const downloadTo = async (src: string, base: string) => {
    if (!src) return
    try {
      const imgPage = await browser.newPage()
      await imgPage.goto(new URL(src).origin, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})
      const file = await imgPage.evaluate(async (u: string) => {
        const res = await fetch(u)
        if (!res.ok) return null
        const type = res.headers.get('content-type') || ''
        const bytes = new Uint8Array(await res.arrayBuffer())
        let bin = ''
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
        return { b64: btoa(bin), type }
      }, src)
      await imgPage.close()
      if (file) {
        const ext = file.type.includes('png') ? 'png' : 'gif'
        // limpa versões antigas para não misturar extensões
        for (const e of ['gif', 'png']) fs.rmSync(path.join(SPRITE_DIR, `${base}.${e}`), { force: true })
        fs.writeFileSync(path.join(SPRITE_DIR, `${base}.${ext}`), Buffer.from(file.b64, 'base64'))
      }
    } catch {
      /* mantém o fallback por nome no widget */
    }
  }
  if (bossHit?.src) await downloadTo(bossHit.src, 'boosted-boss')
  if (creatureHit?.src) await downloadTo(creatureHit.src, 'boosted-creature')

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
