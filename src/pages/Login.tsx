import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'

type AuthMode = 'signin' | 'signup' | 'magic'

export function Login() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, signInWithMagicLink } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (mode === 'magic') {
        await signInWithMagicLink(email)
        setMessage('Check your email for the magic link!')
      } else if (mode === 'signup') {
        await signUpWithEmail(email, password)
        setMessage('Check your email to confirm your account.')
      } else {
        await signInWithEmail(email, password)
        navigate('/')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError('')
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">Quiztoad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            Sign in with Google
          </Button>

          <div className="relative text-center">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <span className="relative bg-card px-2 text-sm text-muted-foreground">or</span>
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as AuthMode)}>
            <TabsList className="w-full">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
              <TabsTrigger value="magic">Magic Link</TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            {mode !== 'magic' && (
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Loading...' : mode === 'magic' ? 'Send Magic Link' : mode === 'signup' ? 'Sign Up' : 'Sign In'}
            </Button>
          </form>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {message && (
            <Alert>
              <AlertDescription className="text-green-600">{message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      <div className="mt-4 text-center text-sm text-muted-foreground">
        <Link to="/terms" className="hover:underline">Terms of Service</Link>
        <span className="mx-2">&middot;</span>
        <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
      </div>
    </div>
  )
}
