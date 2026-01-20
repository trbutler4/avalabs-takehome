import express, { type ErrorRequestHandler } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { db } from './db.js'
import routes from './routes/index.js'

const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json())

// Health check endpoint
app.get('/health', async (_req, res) => {
  try {
    await db.one('SELECT 1')
    res.json({ status: 'healthy', database: 'connected' })
  } catch {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected' })
  }
})

app.use('/', routes)

// Global error handler - must be last
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
}
app.use(errorHandler)

export default app
