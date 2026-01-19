import { Router } from 'express'
import type { Network } from '@repo/shared'
import { pool } from '../db.js'

const router = Router()

router.get('/', async (_req, res) => {
  const { rows } = await pool.query<Network>(
    'SELECT id, chain_id, name, native_coin_id FROM networks ORDER BY name'
  )
  res.json(rows)
})

export default router
