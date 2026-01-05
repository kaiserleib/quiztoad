import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

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
    <div className="login-container">
      <h1>Trivia Master</h1>

      <button onClick={handleGoogleSignIn} className="google-btn" disabled={loading}>
        Sign in with Google
      </button>

      <div className="divider">or</div>

      <div className="mode-tabs">
        <button
          className={mode === 'signin' ? 'active' : ''}
          onClick={() => setMode('signin')}
        >
          Sign In
        </button>
        <button
          className={mode === 'signup' ? 'active' : ''}
          onClick={() => setMode('signup')}
        >
          Sign Up
        </button>
        <button
          className={mode === 'magic' ? 'active' : ''}
          onClick={() => setMode('magic')}
        >
          Magic Link
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {mode !== 'magic' && (
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        )}

        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : mode === 'magic' ? 'Send Magic Link' : mode === 'signup' ? 'Sign Up' : 'Sign In'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {message && <p className="message">{message}</p>}
    </div>
  )
}
