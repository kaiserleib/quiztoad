import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Layout } from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function Settings() {
  const { user } = useAuth()
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return

      const { data } = await supabase
        .from('user_settings')
        .select('claude_api_key')
        .eq('user_id', user.id)
        .single()

      if (data?.claude_api_key) {
        setApiKey('sk-ant-••••••••' + data.claude_api_key.slice(-4))
      }
      setLoading(false)
    }

    loadSettings()
  }, [user])

  const handleSave = async () => {
    if (!user) return

    if (apiKey.includes('••••')) {
      setMessage('Enter a new API key to update')
      return
    }

    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        claude_api_key: apiKey,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

    if (error) {
      setMessage('Failed to save: ' + error.message)
    } else {
      setMessage('API key saved!')
      setApiKey('sk-ant-••••••••' + apiKey.slice(-4))
    }

    setSaving(false)
  }

  const handleClear = async () => {
    if (!user) return

    setSaving(true)

    await supabase
      .from('user_settings')
      .update({ claude_api_key: null })
      .eq('user_id', user.id)

    setApiKey('')
    setMessage('API key cleared')
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-lg">
        Loading...
      </div>
    )
  }

  return (
    <Layout title="Settings" maxWidth="md" backTo="/">
      <Card>
        <CardHeader>
          <CardTitle>Claude API Key</CardTitle>
          <CardDescription>
            Enter your Claude API key to enable AI-generated trivia questions.
            Get one at{' '}
            <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">
              console.anthropic.com
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="sk-ant-api03-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono"
            />
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            {apiKey && (
              <Button variant="outline" onClick={handleClear} disabled={saving}>
                Clear
              </Button>
            )}
          </div>

          {message && (
            <Alert>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </Layout>
  )
}
