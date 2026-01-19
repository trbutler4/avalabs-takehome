import { Router } from 'express'
import type { Network } from '@repo/shared'
import { db } from '../db.js'

const router = Router()

router.get('/', async (_req, res) => {
  const networks = await db.manyOrNone<Network>(
    'SELECT id, chain_id, name, native_coin_id FROM networks ORDER BY name'
  )
  res.json(networks)
})

export default router
