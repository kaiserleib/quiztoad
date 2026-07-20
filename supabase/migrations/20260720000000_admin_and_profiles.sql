-- Profiles: one row per auth user, holding admin/permission flags.
-- The first admin is bootstrapped by email so there's always someone who can
-- grant access to everyone else.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  can_generate boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Bootstrap admin. This is the only email hard-coded anywhere; once this user
-- is an admin they can promote others from the admin panel.
create or replace function public.is_bootstrap_admin(addr text)
  returns boolean
  language sql
  immutable
as $$
  select addr = 'kaiserleib@gmail.com';
$$;

-- Auto-create a profile whenever a new auth user is created. Runs as the
-- definer (postgres) so it can write to profiles regardless of RLS.
create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  insert into public.profiles (id, email, is_admin, can_generate)
  values (
    new.id,
    new.email,
    public.is_bootstrap_admin(new.email),
    public.is_bootstrap_admin(new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users who already exist.
insert into public.profiles (id, email, is_admin, can_generate)
select
  u.id,
  u.email,
  public.is_bootstrap_admin(u.email),
  public.is_bootstrap_admin(u.email)
from auth.users u
on conflict (id) do nothing;

-- Ensure the bootstrap admin is elevated even if their profile already existed.
update public.profiles
set is_admin = true, can_generate = true
where public.is_bootstrap_admin(email);

-- SECURITY DEFINER admin check. Reading profiles inside a profiles RLS policy
-- would recurse; a definer function bypasses RLS and breaks the cycle.
create or replace function public.is_admin(uid uuid)
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = uid), false);
$$;

-- RLS: users can read their own profile; admins can read and update everyone's.
create policy "Users can read own profile" on profiles
  for select using (auth.uid() = id);

create policy "Admins can read all profiles" on profiles
  for select using (public.is_admin(auth.uid()));

create policy "Admins can update any profile" on profiles
  for update using (public.is_admin(auth.uid()));

-- Keep updated_at fresh on any change.
create or replace function public.touch_profile_updated_at()
  returns trigger
  language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on profiles
  for each row execute function public.touch_profile_updated_at();
