import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { Question } from '../lib/database.types'
import {
  blocksFromHtml,
  blocksToPlainText,
  plainTextToHtml,
} from '../lib/questionContent'
import { Layout } from '@/components/Layout'
import { RichQuestionEditor } from '@/components/RichQuestionEditor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface QuestionDraft {
  /**
   * Stable identity for React across reordering. Not the database id — a
   * question that hasn't been saved yet still needs to keep its editor
   * instance when the question above it is deleted.
   */
  key: string
  id?: string
  /** Who owns the underlying questions row; null for legacy rows. */
  authorId?: string | null
  /** Rich content. Canonical — the plain-text column is derived from this. */
  html: string
  answer: string
  /**
   * Content as loaded from the database. Comparing against it tells an edited
   * question from one that was merely reordered, which decides whether a
   * question owned by someone else needs to be forked.
   */
  original?: { html: string; answer: string }
}

const IMPORT_PLACEHOLDER = `1. What is the capital of France?
Answer: Paris

2. Which planet is known as the Red Planet? A) Venus B) Mars C) Jupiter D) Saturn
Answer: B) Mars`

/**
 * Split pasted or generated text into questions. This is the one place the
 * numbered "1. …/Answer: …" format is understood; once questions are in the
 * editor they are rich content and never round-trip back through here.
 */
function parseImportedQuestions(text: string): { text: string; answer: string }[] {
  const lines = text.split('\n')
  const parsed: { text: string; answer: string }[] = []
  let questionLines: string[] = []

  const flush = (answer: string) => {
    const questionText = questionLines.join('\n').trim()
    if (questionText) parsed.push({ text: questionText, answer })
    questionLines = []
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.toLowerCase().startsWith('answer:')) {
      if (questionLines.length > 0) flush(trimmed.substring(7).trim())
      continue
    }

    const numberMatch = trimmed.match(/^(\d+)\.\s*(.*)/)
    if (numberMatch) {
      if (questionLines.length > 0) flush('')
      questionLines = [numberMatch[2]]
      continue
    }

    if (trimmed || questionLines.length > 0) {
      questionLines.push(trimmed)
    }
  }

  if (questionLines.length > 0) flush('')

  return parsed
}

function toDrafts(parsed: { text: string; answer: string }[]): QuestionDraft[] {
  return parsed.map((q) => ({
    key: crypto.randomUUID(),
    html: plainTextToHtml(q.text),
    answer: q.answer,
  }))
}

/** A question needs an answer plus either words or a picture. */
function isBlank(draft: QuestionDraft): boolean {
  const blocks = blocksFromHtml(draft.html)
  return blocks.length === 0
}

export function RoundEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, session, canGenerate } = useAuth()
  const isEditing = Boolean(id)
  const returnTo = searchParams.get('returnTo')

  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  /**
   * Author of the round being edited: `undefined` until the round has loaded,
   * then the author id, or null for a legacy round that has none. The
   * not-yet-loaded state matters — without it the fork banner flashes on every
   * edit while the round is still in flight.
   */
  const [roundAuthorId, setRoundAuthorId] = useState<string | null | undefined>(undefined)
  const [questions, setQuestions] = useState<QuestionDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')

  useEffect(() => {
    const loadRound = async (roundId: string) => {
      const { data: round } = await supabase
        .from('rounds')
        .select('*')
        .eq('id', roundId)
        .single()

      if (!round) return

      setTitle(round.title)
      setTopic(round.topic || '')
      setRoundAuthorId(round.author_id ?? null)

      const { data: roundQuestions } = await supabase
        .from('round_questions')
        .select('position, questions(*)')
        .eq('round_id', roundId)
        .order('position')

      if (!roundQuestions) return

      setQuestions(
        roundQuestions.map((rq) => {
          const q = rq.questions as unknown as Question
          // Questions written before rich text have no text_html; lift their
          // plain text into content so the editor has something to show.
          const html = q.text_html ?? plainTextToHtml(q.text)
          return {
            key: crypto.randomUUID(),
            id: q.id,
            authorId: q.author_id,
            html,
            answer: q.answer,
            original: { html, answer: q.answer },
          }
        })
      )
    }

    if (id) loadRound(id)
  }, [id])

  /**
   * Only the round's author may write to `rounds` or `round_questions` under
   * RLS, so saving someone else's round forks it into a copy of your own —
   * the same move the question-level fork in handleSave already makes. A
   * legacy round with no author has nobody who can update it, so it forks too.
   */
  const forking =
    isEditing && roundAuthorId !== undefined && roundAuthorId !== (user?.id ?? null)

  const generateWithClaude = async () => {
    if (!topic.trim()) {
      setError('Enter a topic first to generate questions')
      return
    }

    setGenerating(true)
    setError('')

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ topic }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to generate questions')
      }

      const data = await response.json()
      const generated = toDrafts(parseImportedQuestions(data.text || ''))

      if (!generated.length) {
        throw new Error("Claude's response didn't contain any questions in the expected format")
      }

      setQuestions((prev) => [...prev, ...generated])
      if (!title.trim()) setTitle(topic)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate questions')
    } finally {
      setGenerating(false)
    }
  }

  const importCount = parseImportedQuestions(importText).length

  const applyImport = () => {
    const imported = toDrafts(parseImportedQuestions(importText))
    if (!imported.length) {
      setError('No questions found. Number each question and follow it with a line starting "Answer:".')
      return
    }
    setQuestions((prev) => [...prev, ...imported])
    setImportText('')
    setImportOpen(false)
    setError('')
  }

  const addQuestion = () => {
    setQuestions([...questions, { key: crypto.randomUUID(), html: '', answer: '' }])
  }

  const updateQuestion = (index: number, field: 'html' | 'answer', value: string) => {
    setQuestions((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
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

    for (let i = 0; i < questions.length; i++) {
      if (isBlank(questions[i])) {
        setError(`Question ${i + 1} is empty — add some text or an image`)
        return
      }
      if (!questions[i].answer.trim()) {
        setError(`Question ${i + 1} needs an answer`)
        return
      }
    }

    setSaving(true)
    setError('')

    try {
      let roundId = id

      if (isEditing && !forking) {
        // These are checked because RLS makes a forbidden write look like a
        // successful no-op rather than an error: it matches zero permitted
        // rows and reports success. An unchecked update here would silently
        // discard the edit.
        const { error: updateError } = await supabase
          .from('rounds')
          .update({ title, topic: topic || null })
          .eq('id', id)

        if (updateError) throw updateError

        const { error: unlinkError } = await supabase
          .from('round_questions')
          .delete()
          .eq('round_id', id)

        if (unlinkError) throw unlinkError
      } else {
        const { data: newRound, error: roundError } = await supabase
          .from('rounds')
          .insert({ title, topic: topic || null, author_id: user?.id })
          .select()
          .single()

        if (roundError) throw roundError
        roundId = newRound.id
      }

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        const text = blocksToPlainText(blocksFromHtml(q.html))
        const edited =
          !q.original || q.original.html !== q.html || q.original.answer !== q.answer
        // Only the author of a question may update it, so an edit to someone
        // else's question forks a copy rather than silently failing under RLS.
        const canUpdateInPlace = Boolean(q.id) && q.authorId === user?.id

        let questionId = q.id

        if (!q.id || (edited && !canUpdateInPlace)) {
          const { data: newQuestion, error: qError } = await supabase
            .from('questions')
            .insert({
              text,
              text_html: q.html,
              topic: topic || null,
              answer: q.answer,
              author_id: user?.id,
            })
            .select()
            .single()

          if (qError) throw qError
          questionId = newQuestion.id
        } else if (edited) {
          const { error: qError } = await supabase
            .from('questions')
            .update({ text, text_html: q.html, answer: q.answer })
            .eq('id', q.id)

          if (qError) throw qError
        }

        const { error: linkError } = await supabase.from('round_questions').insert({
          round_id: roundId,
          question_id: questionId,
          position: i + 1,
        })

        if (linkError) throw linkError
      }

      if (returnTo) {
        if (isEditing && !forking) {
          navigate(returnTo)
        } else {
          // A fork is a new round as far as the caller is concerned, so it
          // gets handed back the same way a freshly created one does.
          const separator = returnTo.includes('?') ? '&' : '?'
          navigate(`${returnTo}${separator}addRound=${roundId}`)
        }
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save round')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout
      title={isEditing ? 'Edit Round' : 'Create New Round'}
      maxWidth="md"
      backTo={returnTo || '/'}
    >
      <div className="space-y-6">
        {forking && (
          <Alert>
            <AlertDescription>
              This round was written by someone else. Saving creates your own copy —
              the original is left untouched.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <Input
            type="text"
            placeholder="Round Title (e.g., Classic Cars)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg"
          />
          <Input
            type="text"
            placeholder="Topic (optional)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Questions ({questions.length})</h2>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              Paste questions
            </Button>
            {canGenerate && (
              <Button
                variant="outline"
                onClick={generateWithClaude}
                disabled={generating}
                className="border-green-300 text-green-700 hover:bg-green-50"
              >
                {generating ? 'Generating...' : 'Generate with Claude'}
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {questions.map((q, index) => (
            <Card key={q.key} className="py-3">
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-muted-foreground">Q{index + 1}</span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon-xs" onClick={() => moveQuestion(index, 'up')} disabled={index === 0}>
                      ↑
                    </Button>
                    <Button variant="outline" size="icon-xs" onClick={() => moveQuestion(index, 'down')} disabled={index === questions.length - 1}>
                      ↓
                    </Button>
                    <Button variant="outline" size="icon-xs" className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50" onClick={() => removeQuestion(index)}>
                      ×
                    </Button>
                  </div>
                </div>
                <RichQuestionEditor
                  value={q.html}
                  onChange={(html) => updateQuestion(index, 'html', html)}
                  userId={user?.id ?? ''}
                  placeholder="Question text (include multiple choice options if applicable)"
                />
                <Input
                  type="text"
                  placeholder="Answer"
                  value={q.answer}
                  onChange={(e) => updateQuestion(index, 'answer', e.target.value)}
                />
              </CardContent>
            </Card>
          ))}

          <Button
            variant="outline"
            className="w-full border-dashed border-2 h-12 text-muted-foreground"
            onClick={addQuestion}
          >
            + Add Question
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? 'Saving...' : 'Save Round'}
          </Button>
        </div>
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Paste questions</DialogTitle>
            <DialogDescription>
              Number each question and put its answer on the next line starting with
              "Answer:". Questions are added to the end of the round, where you can
              edit them and add images.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={IMPORT_PLACEHOLDER}
            rows={14}
            className="font-mono"
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyImport} disabled={!importCount}>
              {importCount === 1 ? 'Add 1 question' : `Add ${importCount} questions`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  )
}
