-- Run this in the Supabase SQL editor after the initial profile/game tables.

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid references public.profiles(id) on delete set null,
  daily_game_id text not null,
  title text not null default 'Daily Challenge',
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists challenges_daily_game_idx
on public.challenges(daily_game_id, created_at desc);

create table if not exists public.challenge_entries (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_session_id uuid references public.game_sessions(id) on delete set null,
  total_score integer not null default 0 check (total_score >= 0),
  rounds_played integer not null default 0 check (rounds_played >= 0),
  completed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (challenge_id, user_id)
);

create index if not exists challenge_entries_score_idx
on public.challenge_entries(challenge_id, total_score desc, completed_at asc);

alter table public.challenges enable row level security;
alter table public.challenge_entries enable row level security;

-- Public challenge links need to be readable by anyone with the URL.
drop policy if exists "Challenges are publicly readable" on public.challenges;
create policy "Challenges are publicly readable"
on public.challenges for select
using (true);

drop policy if exists "Signed-in users can create challenges" on public.challenges;
create policy "Signed-in users can create challenges"
on public.challenges for insert
with check (auth.uid() = creator_user_id);

drop policy if exists "Challenge entries are publicly readable" on public.challenge_entries;
create policy "Challenge entries are publicly readable"
on public.challenge_entries for select
using (true);

drop policy if exists "Users can insert own challenge entries" on public.challenge_entries;
create policy "Users can insert own challenge entries"
on public.challenge_entries for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own challenge entries" on public.challenge_entries;
create policy "Users can update own challenge entries"
on public.challenge_entries for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Enables real daily leaderboard queries without exposing per-round guesses.
drop policy if exists "Completed game sessions are publicly readable" on public.game_sessions;
create policy "Completed game sessions are publicly readable"
on public.game_sessions for select
using (completed_at is not null);
