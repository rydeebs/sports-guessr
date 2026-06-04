-- Run this in the Supabase SQL editor to add email support to app profiles.

alter table public.profiles
add column if not exists email text;

create index if not exists profiles_email_idx
on public.profiles(email);

-- Backfill existing profile emails from Supabase Auth.
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.email is null;

-- Keep new profiles populated when auth users are created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);

  return new;
end;
$$;
