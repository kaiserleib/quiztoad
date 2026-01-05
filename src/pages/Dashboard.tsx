import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="dashboard">
      <header>
        <h1>Trivia Master</h1>
        <div className="user-info">
          <span>{user?.email}</span>
          <button onClick={handleSignOut}>Sign Out</button>
        </div>
      </header>

      <main>
        <section className="actions">
          <h2>What would you like to do?</h2>
          <div className="action-buttons">
            <button onClick={() => navigate('/events/new')}>
              Create New Trivia Night
            </button>
            <button onClick={() => navigate('/rounds/new')}>
              Create New Round
            </button>
            <button onClick={() => navigate('/questions')}>
              Browse Questions
            </button>
          </div>
        </section>

        <section className="recent">
          <h2>Recent Events</h2>
          <p>No events yet. Create your first trivia night!</p>
        </section>
      </main>
    </div>
  )
}
