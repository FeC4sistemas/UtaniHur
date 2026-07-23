import { Router, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

const router = Router()

const DATA_FILE = path.resolve(__dirname, '../../../scraper/output/CurrentAuctions.json')

function loadAuctions() {
  if (!fs.existsSync(DATA_FILE)) return []
  const raw = fs.readFileSync(DATA_FILE, 'utf-8')
  const data = JSON.parse(raw)
  return data.auctions || []
}

router.get('/', (req: Request, res: Response) => {
  try {
    let auctions = loadAuctions()

    // Filtros
    const { vocation, world, minLevel, maxLevel, minMagLevel, page = '1', limit = '25', sortBy = 'auctionEnd', sortOrder = 'asc' } = req.query

    if (vocation) {
      auctions = auctions.filter((a: any) => a.vocation === Number(vocation))
    }
    if (world) {
      auctions = auctions.filter((a: any) => a.worldName.toLowerCase() === String(world).toLowerCase())
    }
    if (minLevel) {
      auctions = auctions.filter((a: any) => a.level >= Number(minLevel))
    }
    if (maxLevel) {
      auctions = auctions.filter((a: any) => a.level <= Number(maxLevel))
    }
    if (minMagLevel) {
      auctions = auctions.filter((a: any) => a.magLevel >= Number(minMagLevel))
    }

    // Ordenação
    auctions.sort((a: any, b: any) => {
      let valA, valB
      switch (sortBy) {
        case 'level':      valA = a.level;        valB = b.level;        break
        case 'price':      valA = a.currentValue; valB = b.currentValue; break
        case 'magLevel':   valA = a.magLevel;     valB = b.magLevel;     break
        default:           valA = a.auctionEnd;   valB = b.auctionEnd;   break
      }
      return sortOrder === 'desc' ? valB - valA : valA - valB
    })

    // Paginação
    const pageNum = Math.max(1, Number(page))
    const limitNum = Math.min(100, Math.max(1, Number(limit)))
    const total = auctions.length
    const totalPages = Math.ceil(total / limitNum)
    const start = (pageNum - 1) * limitNum
    const paginated = auctions.slice(start, start + limitNum)

    res.json({
      auctions: paginated,
      pagination: { page: pageNum, limit: limitNum, total, totalPages }
    })
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar auções' })
  }
})

router.get('/:id', (req: Request, res: Response) => {
  try {
    const auctions = loadAuctions()
    const auction = auctions.find((a: any) => a.id === Number(req.params.id))
    if (!auction) return res.status(404).json({ error: 'Aução não encontrada' })
    res.json(auction)
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar aução' })
  }
})

export default router