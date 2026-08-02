import type { VercelRequest, VercelResponse } from '@vercel/node'
// The .js extension is required, not a typo: package.json sets "type": "module",
// so these compile to ESM, and Node's ESM resolver does not add extensions to
// relative imports. Without it the function dies at module load.
import { getCaller } from './_lib/auth.js'

// Model used for question generation. Trivia generation is a simple task, so
// swapping this to 'claude-sonnet-5' or 'claude-haiku-4-5' would cut cost with
// little quality loss — see the Anthropic model catalog.
const MODEL = 'claude-opus-4-8'

const triviaPrompt = (topic: string) => `Generate 10 trivia questions about "${topic}".

Format each question exactly like this:
- Alternate between short-answer questions and multiple-choice questions
- For short-answer: just the question followed by Answer: on the next line
- For multiple-choice: question followed by A) B) C) D) options, then Answer: with the letter and answer

Example format:
1. What is the capital of France?
Answer: Paris

2. Which planet is known as the Red Planet? A) Venus B) Mars C) Jupiter D) Saturn
Answer: B) Mars

Now generate 10 trivia questions about "${topic}":`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // Everything below runs inside the try. getCaller throws outright when the
  // Supabase server-side env vars are missing, and an uncaught throw here
  // becomes a Vercel error page rather than JSON — which the client can't
  // parse, so the user sees a generic failure with no cause.
  try {
    const caller = await getCaller(req)
    if (!caller) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }
    if (!caller.canGenerate) {
      res.status(403).json({ error: 'You do not have access to Generate with Claude' })
      return
    }

    const topic = (req.body?.topic ?? '').toString().trim()
    if (!topic) {
      res.status(400).json({ error: 'A topic is required' })
      return
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      res.status(500).json({ error: 'Generation is not configured on the server' })
      return
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        messages: [{ role: 'user', content: triviaPrompt(topic) }],
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      res.status(502).json({
        error: errorData?.error?.message || 'Claude API request failed',
      })
      return
    }

    const data = await response.json()
    const text = data.content?.[0]?.text ?? ''
    res.status(200).json({ text })
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to generate questions',
    })
  }
}
