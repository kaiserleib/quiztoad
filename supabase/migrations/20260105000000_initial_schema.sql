-- Questions table
create table questions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  author_id uuid references auth.users(id) on delete set null,
  text text not null,
  answer text not null,
  topic text
);

-- Rounds table
create table rounds (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  author_id uuid references auth.users(id) on delete set null,
  title text not null,
  topic text
);

-- Round questions join table
create table round_questions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references rounds(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  position int not null,
  unique(round_id, question_id),
  unique(round_id, position)
);

-- Events table (a trivia night)
create table events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  author_id uuid references auth.users(id) on delete set null,
  title text not null,
  date date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed'))
);

-- Event rounds join table
create table event_rounds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  round_id uuid references rounds(id) on delete cascade,
  position int not null,
  unique(event_id, round_id),
  unique(event_id, position)
);

-- Enable RLS on all tables
alter table questions enable row level security;
alter table rounds enable row level security;
alter table round_questions enable row level security;
alter table events enable row level security;
alter table event_rounds enable row level security;

-- RLS policies: authenticated users can read all, authors can modify their own

-- Questions policies
create policy "Anyone can read questions" on questions
  for select using (true);

create policy "Users can insert questions" on questions
  for insert with check (auth.uid() = author_id);

create policy "Authors can update their questions" on questions
  for update using (auth.uid() = author_id);

create policy "Authors can delete their questions" on questions
  for delete using (auth.uid() = author_id);

-- Rounds policies
create policy "Anyone can read rounds" on rounds
  for select using (true);

create policy "Users can insert rounds" on rounds
  for insert with check (auth.uid() = author_id);

create policy "Authors can update their rounds" on rounds
  for update using (auth.uid() = author_id);

create policy "Authors can delete their rounds" on rounds
  for delete using (auth.uid() = author_id);

-- Round questions policies
create policy "Anyone can read round_questions" on round_questions
  for select using (true);

create policy "Round authors can insert round_questions" on round_questions
  for insert with check (
    exists (select 1 from rounds where id = round_id and author_id = auth.uid())
  );

create policy "Round authors can update round_questions" on round_questions
  for update using (
    exists (select 1 from rounds where id = round_id and author_id = auth.uid())
  );

create policy "Round authors can delete round_questions" on round_questions
  for delete using (
    exists (select 1 from rounds where id = round_id and author_id = auth.uid())
  );

-- Events policies
create policy "Anyone can read events" on events
  for select using (true);

create policy "Users can insert events" on events
  for insert with check (auth.uid() = author_id);

create policy "Authors can update their events" on events
  for update using (auth.uid() = author_id);

create policy "Authors can delete their events" on events
  for delete using (auth.uid() = author_id);

-- Event rounds policies
create policy "Anyone can read event_rounds" on event_rounds
  for select using (true);

create policy "Event authors can insert event_rounds" on event_rounds
  for insert with check (
    exists (select 1 from events where id = event_id and author_id = auth.uid())
  );

create policy "Event authors can update event_rounds" on event_rounds
  for update using (
    exists (select 1 from events where id = event_id and author_id = auth.uid())
  );

create policy "Event authors can delete event_rounds" on event_rounds
  for delete using (
    exists (select 1 from events where id = event_id and author_id = auth.uid())
  );
