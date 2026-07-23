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

// Pares base → promovida (ex.: filtrar por Elite Knight inclui Knight)
const VOCATION_FAMILY: Record<number, number[]> = {
  1: [1, 5], 5: [1, 5],   // Sorcerer / Master Sorcerer
  2: [2, 6], 6: [2, 6],   // Druid / Elder Druid
  3: [3, 7], 7: [3, 7],   // Paladin / Royal Paladin
  4: [4, 8], 8: [4, 8],   // Knight / Elite Knight
  9: [9, 10], 10: [9, 10] // Monk / Exalted Monk
}

router.get('/options', (_req: Request, res: Response) => {
  try {
    const auctions = loadAuctions()
    const worlds = [...new Set(auctions.map((a: any) => a.worldName as string))].sort()
    const vocMap = new Map<number, string>()
    for (const a of auctions) {
      if (a.vocation > 0) vocMap.set(a.vocation, a.vocationName)
    }
    const vocations = [...vocMap.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.id - b.id)
    res.json({ worlds, vocations })
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar opções de filtro' })
  }
})

router.get('/', (req: Request, res: Response) => {
  try {
    let auctions = loadAuctions()

    // Filtros
    const { search, vocation, world, sex, minLevel, maxLevel, minMagLevel, page = '1', limit = '25', sortBy = 'auctionEnd', sortOrder = 'asc' } = req.query

    if (search) {
      const term = String(search).toLowerCase()
      auctions = auctions.filter((a: any) => a.name.toLowerCase().includes(term))
    }
    if (vocation) {
      const family = VOCATION_FAMILY[Number(vocation)] ?? [Number(vocation)]
      auctions = auctions.filter((a: any) => family.includes(a.vocation))
    }
    if (sex !== undefined && sex !== '') {
      auctions = auctions.filter((a: any) => a.sex === Number(sex))
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