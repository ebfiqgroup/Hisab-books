
-- Profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Users view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);

-- Trigger to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Generic updated_at trigger fn
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Transactions
create type public.txn_type as enum ('income', 'expense');
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.txn_type not null,
  category text not null,
  amount numeric(14,2) not null check (amount >= 0),
  occurred_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
create index transactions_user_date_idx on public.transactions(user_id, occurred_on desc);
alter table public.transactions enable row level security;
create policy "tx select own" on public.transactions for select using (auth.uid() = user_id);
create policy "tx insert own" on public.transactions for insert with check (auth.uid() = user_id);
create policy "tx update own" on public.transactions for update using (auth.uid() = user_id);
create policy "tx delete own" on public.transactions for delete using (auth.uid() = user_id);

-- Goals
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  target numeric(14,2) not null check (target > 0),
  current numeric(14,2) not null default 0 check (current >= 0),
  deadline date,
  color text default 'emerald',
  created_at timestamptz not null default now()
);
alter table public.goals enable row level security;
create policy "goals select own" on public.goals for select using (auth.uid() = user_id);
create policy "goals insert own" on public.goals for insert with check (auth.uid() = user_id);
create policy "goals update own" on public.goals for update using (auth.uid() = user_id);
create policy "goals delete own" on public.goals for delete using (auth.uid() = user_id);

-- Debts (receivable / payable)
create type public.debt_kind as enum ('receivable', 'payable');
create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.debt_kind not null,
  person text not null,
  amount numeric(14,2) not null check (amount >= 0),
  due_date date,
  note text,
  settled boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.debts enable row level security;
create policy "debts select own" on public.debts for select using (auth.uid() = user_id);
create policy "debts insert own" on public.debts for insert with check (auth.uid() = user_id);
create policy "debts update own" on public.debts for update using (auth.uid() = user_id);
create policy "debts delete own" on public.debts for delete using (auth.uid() = user_id);

-- Plan tasks
create type public.priority_level as enum ('উচ্চ', 'মাঝারি', 'নিম্ন');
create table public.plan_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task text not null,
  due_text text,
  amount_text text,
  priority public.priority_level not null default 'মাঝারি',
  done boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.plan_tasks enable row level security;
create policy "plan select own" on public.plan_tasks for select using (auth.uid() = user_id);
create policy "plan insert own" on public.plan_tasks for insert with check (auth.uid() = user_id);
create policy "plan update own" on public.plan_tasks for update using (auth.uid() = user_id);
create policy "plan delete own" on public.plan_tasks for delete using (auth.uid() = user_id);

-- Notes
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.notes enable row level security;
create policy "notes select own" on public.notes for select using (auth.uid() = user_id);
create policy "notes insert own" on public.notes for insert with check (auth.uid() = user_id);
create policy "notes update own" on public.notes for update using (auth.uid() = user_id);
create policy "notes delete own" on public.notes for delete using (auth.uid() = user_id);
