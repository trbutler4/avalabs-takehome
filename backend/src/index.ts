import { createHTTPServer } from '@trpc/server/adapters/standalone'
import cors from 'cors'
import { appRouter } from './router.js'

const server = createHTTPServer({
  middleware: cors(),
  router: appRouter,
})

const PORT = Number(process.env.PORT ?? 3000)

server.listen(PORT)
console.log(`Server listening on http://localhost:${PORT}`)
