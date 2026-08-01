import { supabase } from './supabase'

const BUCKET = 'question-images'
const MAX_BYTES = 10 * 1024 * 1024

/**
 * Mirrors the bucket's allowed_mime_types. Checking here too means a wrong file
 * gets a plain-English message in the editor instead of a storage 400.
 */
const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

export function isSupportedImage(file: File): boolean {
  return file.type in EXTENSIONS
}

/** Pull image files out of a paste or drop, ignoring any other content. */
export function imageFilesFrom(data: DataTransfer | null): File[] {
  if (!data) return []
  return Array.from(data.files).filter((f) => f.type.startsWith('image/'))
}

export class ImageUploadError extends Error {}

/**
 * Upload one image and return its public URL.
 *
 * The path is {userId}/{uuid}.{ext} — the leading segment is what the storage
 * RLS policy checks, so it must stay in sync with the migration.
 */
export async function uploadQuestionImage(file: File, userId: string): Promise<string> {
  if (!isSupportedImage(file)) {
    throw new ImageUploadError(
      `${file.type || 'That file'} isn't a supported image. Use PNG, JPEG, GIF, or WebP.`
    )
  }
  if (file.size > MAX_BYTES) {
    throw new ImageUploadError(
      `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 10 MB.`
    )
  }

  const path = `${userId}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) throw new ImageUploadError(error.message)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) throw new ImageUploadError('Upload succeeded but no public URL came back.')

  return data.publicUrl
}
