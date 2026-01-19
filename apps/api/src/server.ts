import app from './app.js'
import { db } from './db.js'
import { sync } from './coingecko.js'

const PORT = Number(process.env.PORT ?? 3000)

async function main() {
  // Sync on startup if DB is empty
  const { count } = await db.one<{ count: string }>('SELECT COUNT(*) as count FROM networks')
  if (Number(count) === 0) {
    console.log('Database empty, running initial sync...')
    await sync()
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`)
  })

  const shutdown = () => {
    console.log('\nShutting down...')
    server.closeAllConnections()
    server.close(() => {
      db.$pool.end().then(() => process.exit(0))
    })
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch(console.error)
