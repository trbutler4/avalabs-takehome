import { createHTTPServer } from '@trpc/server/adapters/standalone'
import cors from 'cors'
import { appRouter } from './router.js'
import { initDb } from './db.js'
import { sync } from './coingecko.js'

const PORT = Number(process.env.PORT ?? 3000)

async function main() {
  await initDb()
  console.log('Database initialized')

  // Sync on startup if DB is empty
  const { sql } = await import('./db.js')
  const [{ count }] = await sql`SELECT COUNT(*) as count FROM networks`
  if (Number(count) === 0) {
    console.log('Database empty, running initial sync...')
    await sync()
  }

  const server = createHTTPServer({
    middleware: cors(),
    router: appRouter,
  })

  server.listen(PORT)
  console.log(`Server listening on http://localhost:${PORT}`)
}

main().catch(console.error)
