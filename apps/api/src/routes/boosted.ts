import { Router, Request, Response } from 'express'
import path from 'path'
import { readCached } from '../lib/jsonCache'

const router = Router()
const DATA_FILE = path.resolve(__dirname, '../../../scraper/output/Boosted.json')
const EMPTY = { boss: null, creature: null, date: null }

router.get('/', (_req: Request, res: Response) => {
  try {
    res.json(readCached(DATA_FILE, raw => JSON.parse(raw), EMPTY))
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar boost do dia' })
  }
})

export default router
