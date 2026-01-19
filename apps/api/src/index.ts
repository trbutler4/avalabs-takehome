import express from 'express'
import cors from 'cors'
import { pool } from './db.js'
import { sync } from './coingecko.js'
import { registerRoutes } from './routes.js'

const PORT = Number(process.env.PORT ?? 3000)

async function main() {
  const app = express()

  app.use(cors())
  app.use(express.json())

  // Routes
  registerRoutes(app)

  // Sync on startup if DB is empty
  const { rows } = await pool.query('SELECT COUNT(*) as count FROM networks')
  if (Number(rows[0].count) === 0) {
    console.log('Database empty, running initial sync...')
    await sync()
  }

  // Bind to all interfaces to allow access from other machines (e.g., via Tailscale)
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`)
  })

  const shutdown = () => {
    console.log('\nShutting down...')
    server.closeAllConnections()
    server.close(() => {
      pool.end().then(() => process.exit(0))
    })
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch(console.error)
