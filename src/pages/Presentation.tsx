import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Question, Round } from '../lib/database.types'

interface SlideData {
  type: 'cover' | 'round-intro' | 'question'
  title?: string
  date?: string
  roundNumber?: number
  roundTitle?: string
  questionNumber?: number
  questionText?: string
  answer?: string
}

interface RoundInfo {
  number: number
  title: string
  startIndex: number
  questionCount: number
}

export function Presentation() {
  const { id } = useParams()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [slides, setSlides] = useState<SlideData[]>([])
  const [rounds, setRounds] = useState<RoundInfo[]>([])
  const [currentSlide, setCurrentSlide] = useState(0)
  const [loading, setLoading] = useState(true)
  const [reviewingRound, setReviewingRound] = useState<number | null>(null)
  const [answerRevealed, setAnswerRevealed] = useState(false)

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

      const slideList: SlideData[] = []
      const roundList: RoundInfo[] = []

      slideList.push({
        type: 'cover',
        title: event.title,
        date: new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      })

      for (const er of eventRounds) {
        const round = er.rounds as unknown as Round
        const roundStartIndex = slideList.length

        slideList.push({
          type: 'round-intro',
          roundNumber: er.position,
          roundTitle: round.title,
        })

        const { data: roundQuestions } = await supabase
          .from('round_questions')
          .select('position, questions(*)')
          .eq('round_id', round.id)
          .order('position')

        let questionCount = 0
        if (roundQuestions) {
          for (const rq of roundQuestions) {
            const question = rq.questions as unknown as Question

            slideList.push({
              type: 'question',
              roundNumber: er.position,
              questionNumber: rq.position,
              questionText: question.text,
              answer: question.answer,
            })
            questionCount++
          }
        }

        roundList.push({
          number: er.position,
          title: round.title,
          startIndex: roundStartIndex,
          questionCount,
        })
      }

      setSlides(slideList)
      setRounds(roundList)
      setLoading(false)
    }

    if (id) {
      loadEvent(id)
    }
  }, [id, navigate])

  const nextSlide = useCallback(() => {
    const current = slides[currentSlide]

    if (reviewingRound !== null && current?.type === 'question' && !answerRevealed) {
      setAnswerRevealed(true)
      return
    }

    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1)
      setAnswerRevealed(false)
    }
  }, [currentSlide, slides, reviewingRound, answerRevealed])

  const prevSlide = useCallback(() => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1)
      setAnswerRevealed(false)
    }
  }, [currentSlide])

  const goToRound = useCallback((roundNumber: number) => {
    const round = rounds.find((r) => r.number === roundNumber)
    if (round) {
      setCurrentSlide(round.startIndex)
      setReviewingRound(null)
      setAnswerRevealed(false)
    }
  }, [rounds])

  const reviewRound = useCallback((roundNumber: number) => {
    const round = rounds.find((r) => r.number === roundNumber)
    if (round) {
      setCurrentSlide(round.startIndex + 1)
      setReviewingRound(roundNumber)
      setAnswerRevealed(false)
    }
  }, [rounds])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        nextSlide()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prevSlide()
      }
    },
    [nextSlide, prevSlide]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    if (!loading && containerRef.current) {
      containerRef.current.requestFullscreen?.().catch(() => {})
    }
  }, [loading])

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        navigate('/')
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [navigate])

  const exitPresentation = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.()
    }
    navigate('/')
  }

  if (loading) {
    return <div className="fixed inset-0 flex items-center justify-center text-xl text-muted-foreground">Loading...</div>
  }

  const slide = slides[currentSlide]
  const inReviewMode = reviewingRound !== null && slide?.roundNumber === reviewingRound
  const showAnswer = inReviewMode && answerRevealed

  const parseQuestionText = (text: string): { question: string; options: string[] } => {
    const optionsMatch = text.match(/^(.*?)\s*([A-D][).]\s*.*)$/s)
    if (optionsMatch) {
      const optionsText = optionsMatch[2]
      const options = optionsText.split(/(?=[A-D][).]\s*)/).filter(Boolean).map(o => o.trim())
      return {
        question: optionsMatch[1].trim(),
        options,
      }
    }
    return { question: text, options: [] }
  }

  const parsedQuestion = slide?.questionText ? parseQuestionText(slide.questionText) : null

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-white flex items-center justify-center cursor-pointer"
      onClick={nextSlide}
    >
      {/* Top navigation bar */}
      <div
        className="absolute top-0 left-0 right-0 flex justify-between items-center px-4 py-3 bg-white/90 border-b z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-2">
          {rounds.map((round) => (
            <button
              key={round.number}
              onClick={() => goToRound(round.number)}
              className={`px-3 py-1.5 text-sm rounded-md border cursor-pointer transition-colors ${
                slide?.roundNumber === round.number && !reviewingRound
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent border-border text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              Round {round.number}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">
          {currentSlide + 1} / {slides.length}
        </span>
      </div>

      {/* Right side review buttons */}
      <div
        className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {rounds.map((round) => (
          <button
            key={round.number}
            onClick={() => reviewRound(round.number)}
            className={`px-3 py-1.5 text-sm rounded-md border cursor-pointer transition-colors ${
              reviewingRound === round.number
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-transparent border-border text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            Review {round.number}
          </button>
        ))}
      </div>

      <button
        className="absolute top-16 right-20 w-12 h-12 bg-transparent border border-border text-muted-foreground rounded-full text-2xl cursor-pointer flex items-center justify-center hover:bg-accent hover:text-foreground transition-colors"
        onClick={(e) => { e.stopPropagation(); exitPresentation(); }}
      >
        ×
      </button>

      {slide?.type === 'cover' && (
        <div className="text-center p-8 max-w-[90%]">
          <h1 className="text-6xl font-bold mb-4">{slide.title}</h1>
          <p className="text-2xl text-muted-foreground">{slide.date}</p>
        </div>
      )}

      {slide?.type === 'round-intro' && (
        <div className="text-center p-8 max-w-[90%]">
          <p className="text-2xl text-muted-foreground mb-2">Round {slide.roundNumber}</p>
          <h1 className="text-6xl font-bold">{slide.roundTitle}</h1>
        </div>
      )}

      {slide?.type === 'question' && parsedQuestion && (
        <div className="text-center p-8 max-w-[90%]">
          <p className="text-base text-muted-foreground mb-8">
            Round {slide.roundNumber} · Question {slide.questionNumber}
            {inReviewMode && ' · Review'}
          </p>
          <div className="text-4xl leading-relaxed whitespace-pre-wrap max-w-[900px] mx-auto text-left font-medium">
            {parsedQuestion.question}
          </div>
          {parsedQuestion.options.length > 0 && (
            <div className="mt-6 text-left max-w-[900px] mx-auto">
              {parsedQuestion.options.map((option, i) => (
                <div key={i} className="text-3xl font-normal leading-relaxed py-1">{option}</div>
              ))}
            </div>
          )}
          {showAnswer && (
            <div className="mt-12 text-3xl text-primary">
              <span className="text-muted-foreground">Answer:</span> {slide.answer}
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-muted-foreground/50">
        Press → or click to advance · Press ← to go back · Press Esc to exit
      </div>
    </div>
  )
}
