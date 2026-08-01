/**
 * Shared reading of question content.
 *
 * A question is stored two ways: `text_html` holds rich content once the
 * question has been through the editor, and `text` always holds a plain-text
 * projection of it. Everything that displays a question goes through
 * `questionBlocks` here, so the editor preview, the projector slides, and the
 * printed grading sheet can never drift apart in how they read a question.
 *
 * Content is deliberately narrow: paragraphs, line breaks, and images. There is
 * no bold or italic, because the multiple-choice splitting below works on plain
 * strings and slides render at a single weight anyway. Adding marks later means
 * teaching `parseChoices` to split styled runs, not just characters.
 */

export type QuestionBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; src: string; alt: string }

/** Tags that imply a line break around their contents. */
const BLOCK_TAGS = new Set(['p', 'div', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

/**
 * Images are rendered as React <img> elements with only src and alt passed
 * through, so markup can't smuggle in event handlers. This blocks the one
 * remaining trick — a `javascript:` src — and rejects anything exotic.
 */
function isSafeImageSrc(src: string): boolean {
  try {
    const url = new URL(src, window.location.origin)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Split rich HTML into a flat list of blocks. Text runs together across
 * paragraphs into a single text block, breaking only at images: the
 * multiple-choice parser needs to see a whole question's prose at once, and a
 * question whose options sit in separate <p> tags must still parse.
 */
export function blocksFromHtml(html: string): QuestionBlock[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const blocks: QuestionBlock[] = []
  let buffer = ''

  const flush = () => {
    const text = buffer.replace(/\n{3,}/g, '\n\n').trim()
    if (text) blocks.push({ type: 'text', text })
    buffer = ''
  }

  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        buffer += child.nodeValue ?? ''
        continue
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue

      const el = child as Element
      const tag = el.tagName.toLowerCase()

      if (tag === 'img') {
        flush()
        const src = el.getAttribute('src') ?? ''
        if (isSafeImageSrc(src)) {
          blocks.push({ type: 'image', src, alt: el.getAttribute('alt') ?? '' })
        }
        continue
      }

      if (tag === 'br') {
        buffer += '\n'
        continue
      }

      const isBlock = BLOCK_TAGS.has(tag)
      if (isBlock && buffer && !buffer.endsWith('\n')) buffer += '\n'
      walk(el)
      if (isBlock && buffer && !buffer.endsWith('\n')) buffer += '\n'
    }
  }

  walk(doc.body)
  flush()
  return blocks
}

/** Read any question — rich or legacy plain-text — as blocks. */
export function questionBlocks(question: { text: string; text_html?: string | null }): QuestionBlock[] {
  if (question.text_html) return blocksFromHtml(question.text_html)
  const text = question.text.trim()
  return text ? [{ type: 'text', text }] : []
}

/**
 * The plain-text projection written to `questions.text` on save. Images become
 * a visible placeholder rather than vanishing, so an image-only question still
 * reads as something on the printed grading sheet and still satisfies the
 * not-null text column.
 */
export function blocksToPlainText(blocks: QuestionBlock[]): string {
  const hasText = blocks.some((b) => b.type === 'text')
  return blocks
    .map((b) => (b.type === 'text' ? b.text : hasText ? '' : '[image]'))
    .filter(Boolean)
    .join('\n\n')
    .trim()
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Lift plain text into editor content: blank lines become paragraphs, single
 * newlines become breaks. Used when loading a question written before rich text
 * existed, and when importing pasted or Claude-generated questions.
 */
export function plainTextToHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (!paragraphs.length) return ''
  return paragraphs
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/** True when a question carries at least one image. */
export function hasImages(question: { text: string; text_html?: string | null }): boolean {
  return questionBlocks(question).some((b) => b.type === 'image')
}

/**
 * Split a multiple-choice question into its prompt and options.
 *
 * Moved here from the presentation view so the editor preview and the print
 * sheet split questions identically to the projector.
 */
export function parseChoices(text: string): { question: string; options: string[] } {
  const letters = ['A', 'B', 'C', 'D']
  type Marker = { letter: string; delim: string; letterPos: number }
  // Collect candidate option markers: a letter A–D plus ")" or "." delimiter that
  // sits at a word boundary and is immediately followed by whitespace (or end).
  const markerRe = /(^|\s)([A-D])([).])(?=\s|$)/g
  const candidates: Marker[] = []
  for (let m = markerRe.exec(text); m; m = markerRe.exec(text)) {
    candidates.push({ letter: m[2], delim: m[3], letterPos: m.index + m[1].length })
  }
  // Build the longest A, B, C… run for each delimiter style independently, then
  // pick the longest. Requiring a real sequence (sharing one delimiter, starting
  // at A) prevents name initials (e.g. "A. A. Milne", "Arthur C. Clarke") from
  // being mistaken for multiple-choice options.
  let seq: Marker[] = []
  for (const d of [')', '.']) {
    const run: Marker[] = []
    for (const c of candidates) {
      if (c.delim === d && c.letter === letters[run.length]) {
        run.push(c)
        if (run.length === letters.length) break
      }
    }
    if (run.length > seq.length) seq = run
  }
  // Need at least A and B to count as multiple-choice.
  if (seq.length < 2) {
    return { question: text.trim(), options: [] }
  }
  const question = text.slice(0, seq[0].letterPos).trim()
  const options = seq.map((mk, i) => {
    const end = i + 1 < seq.length ? seq[i + 1].letterPos : text.length
    return text.slice(mk.letterPos, end).trim()
  })
  return { question, options }
}
