import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Question, Round } from '../lib/database.types'
import { Button } from '@/components/ui/button'

interface RoundWithQuestions {
  number: number
  title: string
  questions: {
    number: number
    text: string
    answer: string
  }[]
}

export function PrintView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [rounds, setRounds] = useState<RoundWithQuestions[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadEvent = async (eventId: string) => {
      const { data: event } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()

      if (!event) {
        navigate('/')
        return
      }

      const { data: eventRounds } = await supabase
        .from('event_rounds')
        .select('position, rounds(id, title, topic)')
        .eq('event_id', eventId)
        .order('position')

      if (!eventRounds) {
        navigate('/')
        return
      }

      const loadedRounds: RoundWithQuestions[] = []

      for (const er of eventRounds) {
        const round = er.rounds as unknown as Round

        const { data: roundQuestions } = await supabase
          .from('round_questions')
          .select('position, questions(*)')
          .eq('round_id', round.id)
          .order('position')

        const questions =
          roundQuestions?.map((rq) => {
            const q = rq.questions as unknown as Question
            return {
              number: rq.position,
              text: q.text,
              answer: q.answer,
            }
          }) || []

        loadedRounds.push({
          number: er.position,
          title: round.title,
          questions,
        })
      }

      setRounds(loadedRounds)
      setLoading(false)
    }

    if (id) {
      loadEvent(id)
    }
  }, [id, navigate])

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-lg">Loading...</div>
  }

  return (
    <div className="print-view max-w-3xl mx-auto p-8">
      <div className="no-print flex gap-3 mb-8">
        <Button variant="outline" onClick={() => navigate('/')}>
          Back
        </Button>
        <Button onClick={handlePrint}>
          Print
        </Button>
      </div>

      {rounds.map((round) => (
        <div key={round.number} className="print-round mb-12 pb-8 border-b last:border-b-0">
          <div className="mb-6">
            <h1 className="text-2xl font-bold m-0 mb-1">Round {round.number}: {round.title}</h1>
          </div>

          <ol className="list-decimal pl-6 m-0">
            {round.questions.map((q) => (
              <li key={q.number} className="mb-4 pb-4 border-b border-border/50 last:border-b-0 last:mb-0 last:pb-0">
                <div className="mb-2 whitespace-pre-wrap">{q.text}</div>
                <div className="text-primary font-medium">Answer: {q.answer}</div>
              </li>
            ))}
          </ol>
        </div>
      ))}

      <style>{`
        @media print {
          body { background: white; color: black; font-size: 10pt; }
          .no-print { display: none !important; }
          .print-view { max-width: none; padding: 0; }
          .print-round {
            page-break-after: always;
            page-break-inside: avoid;
            border-bottom: none;
            margin-bottom: 0;
            padding: 0.25in;
          }
          .print-round:last-child { page-break-after: auto; }
          .print-round h1 { font-size: 14pt; margin: 0 0 2pt 0; }
          .print-round ol { padding-left: 0.2in; margin: 0; }
          .print-round li {
            margin-bottom: 0.06in;
            padding-bottom: 0.06in;
            border-bottom: 0.5pt solid #ccc;
            font-size: 9pt;
            line-height: 1.25;
          }
          .print-round li:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
          }
          .print-round .whitespace-pre-wrap { margin-bottom: 2pt; }
          .print-round .text-primary { color: #333; font-size: 8pt; }
        }
      `}</style>
    </div>
  )
}
