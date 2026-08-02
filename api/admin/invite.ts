import type { VercelRequest, VercelResponse } from '@vercel/node'
// .js extension required — these compile to ESM ("type": "module"), and Node's
// ESM resolver does not add extensions to relative imports.
import { getCaller, serviceClient } from '../_lib/auth.js'

async function sendInviteEmail(to: string, link: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) return false

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to,
      subject: "You've been invited to Quiztoad",
      html: `<p>You've been invited to Quiztoad, the trivia night manager.</p>
             <p><a href="${link}">Accept your invitation</a> to set a password and get started.</p>`,
    }),
  })
  return resp.ok
}

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

  const email = (req.body?.email ?? '').toString().trim().toLowerCase()
  const canGenerate = Boolean(req.body?.canGenerate)
  if (!email || !email.includes('@')) {
    res.status(400).json({ error: 'A valid email is required' })
    return
  }

  const admin = serviceClient()
  const redirectTo = process.env.APP_URL || undefined

  // Generate an invite link (this also creates the auth user). We send the
  // email ourselves via Resend rather than Supabase's built-in SMTP.
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: redirectTo ? { redirectTo } : undefined,
  })

  if (error || !data.user) {
    const message = error?.message || 'Failed to create invite'
    const status = /already/i.test(message) ? 409 : 400
    res.status(status).json({ error: message })
    return
  }

  // Apply the initial generate permission (the profile row was created by the
  // on_auth_user_created trigger).
  if (canGenerate) {
    await admin
      .from('profiles')
      .update({ can_generate: true })
      .eq('id', data.user.id)
  }

  const link = data.properties?.action_link
  const emailed = link ? await sendInviteEmail(email, link) : false

  res.status(200).json({
    ok: true,
    emailed,
    // If email delivery isn't configured, return the link so the admin can
    // share it manually.
    inviteLink: emailed ? undefined : link,
  })
}
