/*
  Baixa as imagens de outfit do char bazaar oficial (indexadas por lookType)
  para todos os pares (lookType, lookAddons) presentes nos dados coletados.

  Saída: apps/web/public/sprites/looktypes/{lookType}_{addons}.gif
  Uso:   npm run sprites   (na raiz do monorepo)

  O script é idempotente: arquivos já baixados são pulados. lookTypes que não
  existem no CDN oficial (outfits custom do servidor) são apenas reportados —
  o frontend cai no fallback para esses casos.
*/
import fs from 'fs'
import path from 'path'

const CURRENT_FILE = path.resolve(__dirname, '../../output/CurrentAuctions.json')
const HISTORY_FILE = path.resolve(__dirname, '../../output/HistoryAuctions.jsonl')
const OUTPUT_DIR = path.resolve(__dirname, '../../../web/public/sprites/looktypes')
const BASE_URL = 'https://static.tibia.com/images/charactertrade/outfits'
const DELAY_MS = 250

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function collectPairs(): Set<string> {
  const pairs = new Set<string>()
  const add = (a: any) => {
    if (typeof a?.lookType === 'number' && a.lookType > 0) {
      pairs.add(`${a.lookType}_${a.lookAddons ?? 0}`)
    }
  }

  if (fs.existsSync(CURRENT_FILE)) {
    const data = JSON.parse(fs.readFileSync(CURRENT_FILE, 'utf-8'))
    for (const a of data.auctions ?? []) add(a)
  }
  if (fs.existsSync(HISTORY_FILE)) {
    for (const line of fs.readFileSync(HISTORY_FILE, 'utf-8').split('\n')) {
      if (line.trim()) add(JSON.parse(line))
    }
  }
  return pairs
}

async function main() {
  const pairs = [...collectPairs()].sort()
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  console.log(`🎨 ${pairs.length} combinações de outfit encontradas nos dados`)

  let downloaded = 0
  let skipped = 0
  const missing: string[] = []

  for (const pair of pairs) {
    const dest = path.join(OUTPUT_DIR, `${pair}.gif`)
    if (fs.existsSync(dest)) {
      skipped++
      continue
    }

    try {
      const res = await fetch(`${BASE_URL}/${pair}.gif`)
      if (!res.ok) {
        missing.push(pair)
      } else {
        fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
        downloaded++
      }
    } catch (err: any) {
      console.error(`\n⚠️  ${pair}: ${err.message}`)
      missing.push(pair)
    }

    process.stdout.write(`\r⬇️  baixados: ${downloaded} | existentes: ${skipped} | sem imagem: ${missing.length}`)
    await sleep(DELAY_MS)
  }

  console.log(`\n✅ Concluído. ${downloaded} novas sprites em ${path.relative(process.cwd(), OUTPUT_DIR)}`)
  if (missing.length > 0) {
    console.log(`ℹ️  ${missing.length} lookTypes sem imagem oficial (outfits custom?): ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? '…' : ''}`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
