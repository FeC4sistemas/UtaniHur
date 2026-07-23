import express from 'express'
import cors from 'cors'
import compression from 'compression'
import auctionsRouter from './routes/auctions'
import historyRouter from './routes/history'
import statsRouter from './routes/stats'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(compression())
app.use(express.json())

app.use('/api/auctions', auctionsRouter)
app.use('/api/history', historyRouter)
app.use('/api/stats', statsRouter)

app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`🏰 Utanihur API rodando em http://localhost:${PORT}`)
})