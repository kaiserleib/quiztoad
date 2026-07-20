import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getCaller, serviceClient } from '../_lib/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const caller = await getCaller(req)
  if (!caller) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }
  if (!caller.isAdmin) {
    res.status(403).json({ error: 'Admin access required' })
    return
  }

  const userId = (req.body?.userId ?? '').toString().trim()
  if (!userId) {
    res.status(400).json({ error: 'A userId is required' })
    return
  }
  if (userId === caller.id) {
    res.status(400).json({ error: 'You cannot delete your own account' })
    return
  }

  const admin = serviceClient()
  // Deleting the auth user cascades to the profile row (FK on delete cascade).
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) {
    res.status(400).json({ error: error.message })
    return
  }

  res.status(200).json({ ok: true })
}
