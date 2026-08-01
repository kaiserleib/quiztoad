import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, useEditorState, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { ImageIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  ImageUploadError,
  imageFilesFrom,
  uploadQuestionImage,
} from '@/lib/uploadQuestionImage'

interface RichQuestionEditorProps {
  /** Question content as HTML. */
  value: string
  onChange: (html: string) => void
  /** Uploads are stored under this user's folder; the storage policy requires it. */
  userId: string
  placeholder?: string
}

/**
 * The question editor. Text and inline images, nothing else — see the note in
 * lib/questionContent.ts for why marks are deliberately turned off.
 *
 * Images arrive three ways: pasted, dropped, or picked from the toolbar. All
 * three land in `insertImages`, which uploads first and only then puts a node in
 * the document, so the editor never holds a blob: or data: URL that would break
 * the moment the round was reloaded.
 */
export function RichQuestionEditor({
  value,
  onChange,
  userId,
  placeholder,
}: RichQuestionEditorProps) {
  const [uploading, setUploading] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // useEditor's config is built once, so anything it calls has to be read
  // through a ref rather than captured from the render that created it.
  const editorRef = useRef<Editor | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // The HTML we last handed to the parent. Used to tell "the parent changed the
  // content underneath us" (an import) from "the parent is echoing back what we
  // just typed", which would otherwise reset the cursor on every keystroke.
  const lastEmittedRef = useRef(value)

  const insertImages = useCallback(
    async (files: File[]) => {
      if (!files.length) return
      setUploadError('')
      setUploading((n) => n + files.length)

      for (const file of files) {
        try {
          const src = await uploadQuestionImage(file, userId)
          editorRef.current?.chain().focus().setImage({ src, alt: file.name }).run()
        } catch (err) {
          setUploadError(
            err instanceof ImageUploadError
              ? err.message
              : `Couldn't upload ${file.name}. Check your connection and try again.`
          )
        } finally {
          setUploading((n) => n - 1)
        }
      }
    },
    [userId]
  )

  const insertImagesRef = useRef(insertImages)
  insertImagesRef.current = insertImages

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Everything that can't survive the round trip to a slide is off.
        bold: false,
        italic: false,
        strike: false,
        underline: false,
        code: false,
        codeBlock: false,
        heading: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        horizontalRule: false,
        link: false,
      }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: { class: 'question-image' },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          'tiptap-question min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-[color,box-shadow] md:text-sm',
      },
      handlePaste: (_view, event) => {
        const files = imageFilesFrom(event.clipboardData)
        if (!files.length) return false
        event.preventDefault()
        void insertImagesRef.current(files)
        return true
      },
      handleDrop: (_view, event, _slice, moved) => {
        // `moved` means the user is dragging an image already in the document;
        // let ProseMirror handle that as a move rather than re-uploading it.
        if (moved) return false
        const files = imageFilesFrom(event.dataTransfer)
        if (!files.length) return false
        event.preventDefault()
        void insertImagesRef.current(files)
        return true
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? '' : editor.getHTML()
      lastEmittedRef.current = html
      onChangeRef.current(html)
    },
  })

  editorRef.current = editor

  // Adopt content the parent replaced wholesale — importing pasted questions or
  // generating a round with Claude.
  useEffect(() => {
    if (!editor) return
    if (value === lastEmittedRef.current) return
    lastEmittedRef.current = value
    editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, value])

  const handleFilePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    void insertImages(files)
    // Reset so picking the same file twice in a row still fires a change.
    event.target.value = ''
  }

  // useEditor doesn't re-render on transactions in Tiptap 3, so reading
  // editor.isEmpty directly would leave the placeholder frozen at its initial
  // value. useEditorState subscribes to just this one derived bit.
  const isEmpty = useEditorState({
    editor,
    selector: ({ editor }) => !editor || editor.isEmpty,
  })

  return (
    <div className="space-y-2">
      <div className="relative">
        <EditorContent editor={editor} />
        {isEmpty && placeholder && (
          <div className="pointer-events-none absolute top-2 left-3 text-base text-muted-foreground md:text-sm">
            {placeholder}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon /> Add image
        </Button>
        <span className="text-xs text-muted-foreground">
          or paste and drag images straight in
        </span>
        {uploading > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Uploading {uploading} image{uploading === 1 ? '' : 's'}…
          </span>
        )}
      </div>

      {uploadError && (
        <p className={cn('text-xs text-destructive')}>{uploadError}</p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={handleFilePick}
      />
    </div>
  )
}
