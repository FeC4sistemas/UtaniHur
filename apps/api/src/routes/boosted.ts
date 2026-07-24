import { Router, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

const router = Router()
const DATA_FILE = path.resolve(__dirname, '../../../scraper/output/Boosted.json')

router.get('/', (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(DATA_FILE)) return res.json({ boss: null, creature: null, date: null })
    res.json(JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')))
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar boost do dia' })
  }
})

export default router
