import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/database.types'
import { Layout } from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

export function Admin() {
  const { user, session } = useAuth()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteCanGenerate, setInviteCanGenerate] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadUsers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })
    setUsers((data as Profile[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const callApi = async (path: string, body: unknown) => {
    const res = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data?.error || 'Request failed')
    }
    return data
  }

  const handleInvite = async () => {
    setError('')
    setMessage('')
    const email = inviteEmail.trim()
    if (!email) {
      setError('Enter an email address')
      return
    }

    setInviting(true)
    try {
      const result = await callApi('/api/admin/invite', {
        email,
        canGenerate: inviteCanGenerate,
      })
      if (result.emailed) {
        setMessage(`Invitation emailed to ${email}`)
      } else if (result.inviteLink) {
        setMessage(`User created. Email isn't configured — share this link: ${result.inviteLink}`)
      } else {
        setMessage(`User created for ${email}`)
      }
      setInviteEmail('')
      setInviteCanGenerate(false)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite user')
    } finally {
      setInviting(false)
    }
  }

  const updateFlag = async (profile: Profile, field: 'can_generate' | 'is_admin', value: boolean) => {
    setError('')
    setMessage('')
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ [field]: value })
      .eq('id', profile.id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === profile.id ? { ...u, [field]: value } : u))
    )
  }

  const handleDelete = async (profile: Profile) => {
    if (!window.confirm(`Delete ${profile.email}? This removes their account and all access.`)) {
      return
    }
    setError('')
    setMessage('')
    try {
      await callApi('/api/admin/delete-user', { userId: profile.id })
      setUsers((prev) => prev.filter((u) => u.id !== profile.id))
      setMessage(`Deleted ${profile.email}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  return (
    <Layout title="Admin" maxWidth="lg" backTo="/">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Invite a user</CardTitle>
            <CardDescription>
              Create an account and email an invitation. New users can be granted
              "Generate with Claude" access now or later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Input
                type="email"
                placeholder="person@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 min-w-[220px]"
              />
              <Button onClick={handleInvite} disabled={inviting}>
                {inviting ? 'Inviting...' : 'Send Invite'}
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={inviteCanGenerate}
                onChange={(e) => setInviteCanGenerate(e.target.checked)}
              />
              Grant "Generate with Claude" access
            </label>
          </CardContent>
        </Card>

        {message && (
          <Alert>
            <AlertDescription className="break-all">{message}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-lg font-semibold">Users</h2>
            {users.length > 0 && <Badge variant="secondary">{users.length}</Badge>}
          </div>

          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-3">
              {users.map((u) => {
                const isSelf = u.id === user?.id
                return (
                  <Card key={u.id} className="py-3">
                    <CardContent className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{u.email}</span>
                        {u.is_admin && <Badge>Admin</Badge>}
                        {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={u.can_generate}
                            onChange={(e) => updateFlag(u, 'can_generate', e.target.checked)}
                          />
                          Generate
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={u.is_admin}
                            disabled={isSelf}
                            onChange={(e) => updateFlag(u, 'is_admin', e.target.checked)}
                          />
                          Admin
                        </label>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={isSelf}
                          onClick={() => handleDelete(u)}
                        >
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </Layout>
  )
}
