import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { Question } from '../lib/database.types'

interface QuestionDraft {
  id?: string
  text: string
  answer: string
  isNew?: boolean
}

export function RoundEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isEditing = Boolean(id)

  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [questions, setQuestions] = useState<QuestionDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (id) {
      loadRound(id)
    }
  }, [id])

  const loadRound = async (roundId: string) => {
    const { data: round } = await supabase
      .from('rounds')
      .select('*')
      .eq('id', roundId)
      .single()

    if (round) {
      setTitle(round.title)
      setTopic(round.topic || '')

      const { data: roundQuestions } = await supabase
        .from('round_questions')
        .select('position, questions(*)')
        .eq('round_id', roundId)
        .order('position')

      if (roundQuestions) {
        setQuestions(
          roundQuestions.map((rq) => {
            const q = rq.questions as unknown as Question
            return {
              id: q.id,
              text: q.text,
              answer: q.answer,
            }
          })
        )
      }
    }
  }

  const addQuestion = () => {
    setQuestions([...questions, { text: '', answer: '', isNew: true }])
  }

  const updateQuestion = (index: number, field: 'text' | 'answer', value: string) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: value }
    setQuestions(updated)
  }

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === questions.length - 1)
    ) {
      return
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1
    const updated = [...questions]
    ;[updated[index], updated[newIndex]] = [updated[newIndex], updated[index]]
    setQuestions(updated)
  }

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Round title is required')
      return
    }

    if (questions.length === 0) {
      setError('Add at least one question')
      return
    }

    for (const q of questions) {
      if (!q.text.trim() || !q.answer.trim()) {
        setError('All questions must have text and an answer')
        return
      }
    }

    setSaving(true)
    setError('')

    try {
      let roundId = id

      if (isEditing) {
        await supabase
          .from('rounds')
          .update({ title, topic: topic || null })
          .eq('id', id)

        // Delete existing round_questions
        await supabase.from('round_questions').delete().eq('round_id', id)
      } else {
        const { data: newRound, error: roundError } = await supabase
          .from('rounds')
          .insert({ title, topic: topic || null, author_id: user?.id })
          .select()
          .single()

        if (roundError) throw roundError
        roundId = newRound.id
      }

      // Create/update questions and link to round
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        let questionId = q.id

        if (q.isNew || !q.id) {
          const { data: newQuestion, error: qError } = await supabase
            .from('questions')
            .insert({
              text: q.text,
              answer: q.answer,
              topic: topic || null,
              author_id: user?.id,
            })
            .select()
            .single()

          if (qError) throw qError
          questionId = newQuestion.id
        } else {
          await supabase
            .from('questions')
            .update({ text: q.text, answer: q.answer })
            .eq('id', q.id)
        }

        await supabase.from('round_questions').insert({
          round_id: roundId,
          question_id: questionId,
          position: i + 1,
        })
      }

      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save round')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="round-editor">
      <header>
        <h1>{isEditing ? 'Edit Round' : 'Create New Round'}</h1>
        <button onClick={() => navigate('/')} className="back-btn">
          Back
        </button>
      </header>

      <div className="round-meta">
        <input
          type="text"
          placeholder="Round Title (e.g., Classic Cars)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="title-input"
        />
        <input
          type="text"
          placeholder="Topic (optional)"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="topic-input"
        />
      </div>

      <div className="questions-list">
        <h2>Questions ({questions.length})</h2>

        {questions.map((q, index) => (
          <div key={index} className="question-card">
            <div className="question-header">
              <span className="question-number">Q{index + 1}</span>
              <div className="question-actions">
                <button onClick={() => moveQuestion(index, 'up')} disabled={index === 0}>
                  ↑
                </button>
                <button
                  onClick={() => moveQuestion(index, 'down')}
                  disabled={index === questions.length - 1}
                >
                  ↓
                </button>
                <button onClick={() => removeQuestion(index)} className="remove-btn">
                  ×
                </button>
              </div>
            </div>
            <textarea
              placeholder="Question text (include multiple choice options if applicable)"
              value={q.text}
              onChange={(e) => updateQuestion(index, 'text', e.target.value)}
              rows={3}
            />
            <input
              type="text"
              placeholder="Answer"
              value={q.answer}
              onChange={(e) => updateQuestion(index, 'answer', e.target.value)}
            />
          </div>
        ))}

        <button onClick={addQuestion} className="add-question-btn">
          + Add Question
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="save-actions">
        <button onClick={handleSave} disabled={saving} className="save-btn">
          {saving ? 'Saving...' : 'Save Round'}
        </button>
      </div>
    </div>
  )
}
