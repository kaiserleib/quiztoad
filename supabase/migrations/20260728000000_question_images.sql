-- Inline images in questions.
--
-- Questions gain a rich-text representation alongside the existing plain text.
-- `text_html` is the canonical content once a question has been touched by the
-- rich editor; `text` is kept as a plain-text projection of it so that the
-- multiple-choice parser, the printed grading sheet, and anything that greps
-- question text keep working unchanged. Questions written before this migration
-- have a null `text_html` and render from `text` exactly as they always did.

alter table questions add column text_html text;

comment on column questions.text_html is
  'Rich-text question content (sanitized HTML subset: p, br, strong, em, img). Null for plain-text questions. When present, text holds its plain-text projection.';

-- Storage bucket for images pasted into the question editor.
--
-- Public read: presentation and print views load images directly by URL, and a
-- projector-side signed-URL refresh is a failure mode we do not want mid-event.
-- SVG is deliberately excluded from the allowed types — it can carry script,
-- and no trivia image needs it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'question-images',
  'question-images',
  true,
  10485760, -- 10 MiB
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
on conflict (id) do nothing;

-- Objects are stored at {user_id}/{uuid}.{ext}. Scoping writes by the leading
-- path segment is what ties an upload to its uploader; it avoids depending on
-- storage.objects.owner, which Supabase has deprecated in favour of owner_id.

create policy "Anyone can read question images" on storage.objects
  for select using (bucket_id = 'question-images');

create policy "Users can upload their own question images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'question-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own question images" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'question-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own question images" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'question-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
