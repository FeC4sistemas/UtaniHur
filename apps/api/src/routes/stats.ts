import { Router, Request, Response } from 'express'
import path from 'path'
import { readCached, memoByFiles } from '../lib/jsonCache'

const router = Router()

const CURRENT_FILE = path.resolve(__dirname, '../../../scraper/output/CurrentAuctions.json')
const HISTORY_FILE = path.resolve(__dirname, '../../../scraper/output/HistoryAuctions.jsonl')

router.get('/', (_req: Request, res: Response) => {
  try {
    // Todo o cálculo é memoizado pelos mtimes de current/history — só recomputa
    // quando o scraper reescreve (evita reparsear ~16MB por request).
    const payload = memoByFiles('stats:overview', [CURRENT_FILE, HISTORY_FILE], () => {
    const currentRaw = readCached(CURRENT_FILE, raw => JSON.parse(raw), { auctions: [], scrapedAt: null })
    const current = currentRaw.auctions || []
    const history = readCached(HISTORY_FILE, raw => raw.split('\n').filter(Boolean).map((l: string) => JSON.parse(l)), [])
    const sold    = history.filter((a: any) => a.stateName === 'finished' && a.currentValue > 0)

    // Preço médio por vocação
    const vocMap: Record<string, number[]> = {}
    for (const a of sold) {
      if (!vocMap[a.vocationName]) vocMap[a.vocationName] = []
      vocMap[a.vocationName].push(a.currentValue)
    }
    const avgPriceByVocation = Object.entries(vocMap).map(([voc, prices]) => ({
      vocation: voc,
      avgPrice: Math.round(prices.reduce((s, p) => s + p, 0) / prices.length),
      count: prices.length
    })).sort((a, b) => b.avgPrice - a.avgPrice)

    // Distribuição de levels nas auções ativas
    const levelRanges = [
      { label: '1-200',   min: 1,   max: 200  },
      { label: '201-400', min: 201, max: 400  },
      { label: '401-600', min: 401, max: 600  },
      { label: '601-800', min: 601, max: 800  },
      { label: '800+',    min: 801, max: 99999},
    ]
    const levelDistribution = levelRanges.map(r => ({
      range: r.label,
      count: current.filter((a: any) => a.level >= r.min && a.level <= r.max).length
    }))

    // Mundos com mais auções ativas
    const worldMap: Record<string, number> = {}
    for (const a of current) {
      worldMap[a.worldName] = (worldMap[a.worldName] || 0) + 1
    }
    const topWorlds = Object.entries(worldMap)
      .map(([world, count]) => ({ world, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      overview: {
        totalActive: current.length,
        totalHistory: history.length,
        totalSold: sold.length,
        totalCancelled: history.filter((a: any) => a.stateName === 'cancelled').length,
      },
      avgPriceByVocation,
      levelDistribution,
      topWorlds,
      lastUpdated: currentRaw.scrapedAt ?? null,
    }
    })
    res.json(payload)
  } catch (err) {
    res.status(500).json({ error: 'Erro ao calcular estatísticas' })
  }
})

export default router