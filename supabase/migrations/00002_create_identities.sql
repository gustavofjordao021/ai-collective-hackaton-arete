-- Migration: Create identities table
-- Stores user identity (one per user)

create table if not exists public.identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null default '{}',
  version text default '1.0.0',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

-- Enable RLS
alter table public.identities enable row level security;

-- Policies: users can only access their own identity
create policy "Users can view own identity"
  on identities for select
  using (auth.uid() = user_id);

create policy "Users can insert own identity"
  on identities for insert
  with check (auth.uid() = user_id);

create policy "Users can update own identity"
  on identities for update
  using (auth.uid() = user_id);

create policy "Users can delete own identity"
  on identities for delete
  using (auth.uid() = user_id);

-- Index for user lookups
create index if not exists identities_user_id_idx on identities(user_id);

-- Trigger to update updated_at
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger identities_updated_at
  before update on identities
  for each row execute procedure public.update_updated_at();
