import express from 'express'
import cors from 'cors'
import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'
import { pool } from './db.js'
import { sync } from './coingecko.js'
import { registerRoutes } from './routes.js'

const PORT = Number(process.env.PORT ?? 3000)

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Asset Registry API',
      version: '1.0.0',
      description: 'API for crypto networks and tokens data',
    },
  },
  apis: ['./src/routes.ts'],
})

async function main() {
  const app = express()

  app.use(cors())
  app.use(express.json())

  // OpenAPI docs
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
  app.get('/openapi.json', (_req, res) => res.json(swaggerSpec))

  // Routes
  registerRoutes(app)

  // Sync on startup if DB is empty
  const { rows } = await pool.query('SELECT COUNT(*) as count FROM networks')
  if (Number(rows[0].count) === 0) {
    console.log('Database empty, running initial sync...')
    await sync()
  }

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`)
    console.log(`OpenAPI docs at http://localhost:${PORT}/docs`)
  })
}

main().catch(console.error)
