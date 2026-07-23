import { Router, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

const router = Router()
const DATA_FILE = path.resolve(__dirname, '../../../scraper/output/HistoryAuctions.jsonl')

function loadHistory() {
  if (!fs.existsSync(DATA_FILE)) return []
  const lines = fs.readFileSync(DATA_FILE, 'utf-8').split('\n').filter(Boolean)
  return lines.map(line => JSON.parse(line))
}

router.get('/', (req: Request, res: Response) => {
  try {
    let auctions = loadHistory()

    const { vocation, world, minLevel, maxLevel, status, page = '1', limit = '25', sortBy = 'auctionEnd', sortOrder = 'desc' } = req.query

    if (vocation)  auctions = auctions.filter((a: any) => a.vocation === Number(vocation))
    if (world)     auctions = auctions.filter((a: any) => a.worldName.toLowerCase() === String(world).toLowerCase())
    if (minLevel)  auctions = auctions.filter((a: any) => a.level >= Number(minLevel))
    if (maxLevel)  auctions = auctions.filter((a: any) => a.level <= Number(maxLevel))
    if (status)    auctions = auctions.filter((a: any) => a.stateName === String(status))

    auctions.sort((a: any, b: any) => {
      let valA, valB
      switch (sortBy) {
        case 'level':  valA = a.level;        valB = b.level;        break
        case 'price':  valA = a.currentValue; valB = b.currentValue; break
        default:       valA = a.auctionEnd;   valB = b.auctionEnd;   break
      }
      return sortOrder === 'desc' ? valB - valA : valA - valB
    })

    const pageNum  = Math.max(1, Number(page))
    const limitNum = Math.min(100, Math.max(1, Number(limit)))
    const total    = auctions.length
    const totalPages = Math.ceil(total / limitNum)
    const start    = (pageNum - 1) * limitNum
    const paginated = auctions.slice(start, start + limitNum)

    res.json({
      auctions: paginated,
      pagination: { page: pageNum, limit: limitNum, total, totalPages }
    })
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar histórico' })
  }
})

export default router