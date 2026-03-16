-- EcoWallet Supabase schema (run in Supabase SQL Editor)

-- Tables
create table if not exists public.users (
    id bigserial primary key,
    auth_id uuid unique not null,
    name text not null,
    email text unique not null,
    password text not null default '',
    phone text,
    address text,
    state text not null default 'Unknown',
    role text not null default 'user' check (role in ('user', 'agent', 'admin')),
    google_id text unique,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    deleted_at timestamptz
);

alter table if exists public.users
    add column if not exists phone text;

alter table if exists public.users
    add column if not exists address text;

create table if not exists public.wallets (
    id bigserial primary key,
    user_id bigint unique not null references public.users(id) on delete cascade,
    balance numeric(15,2) not null default 0.00,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists public.waste_submissions (
    id bigserial primary key,
    user_id bigint not null references public.users(id),
    agent_id bigint references public.users(id) on delete set null,
    material_type text not null check (material_type in ('PET', 'HDPE', 'Aluminum', 'Paper')),
    weight_kg numeric(10,3) not null,
    location text not null,
    payout numeric(15,2) not null default 0.00,
    co2_saved numeric(10,3) not null default 0.00,
    status text not null default 'pending' check (status in ('pending', 'collected')),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists public.withdrawal_requests (
    id bigserial primary key,
    user_id bigint not null references public.users(id) on delete cascade,
    amount numeric(15,2) not null,
    method text not null check (method in ('airtime', 'mobile_data', 'bank_transfer')),
    phone_number text,
    bank_details jsonb,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Indexes
create index if not exists idx_users_auth_id on public.users(auth_id);
create index if not exists idx_users_role on public.users(role);
create index if not exists idx_waste_user on public.waste_submissions(user_id);
create index if not exists idx_waste_agent on public.waste_submissions(agent_id);
create index if not exists idx_waste_status on public.waste_submissions(status);
create index if not exists idx_waste_created on public.waste_submissions(created_at);
create index if not exists idx_withdrawal_user on public.withdrawal_requests(user_id);
create index if not exists idx_withdrawal_status on public.withdrawal_requests(status);

-- Helpers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create or replace function public.current_user_id()
returns bigint
language sql
stable
as $$
    select id
    from public.users
    where auth_id = auth.uid()
      and deleted_at is null;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
    select exists(
        select 1
        from public.users
        where auth_id = auth.uid()
          and role = 'admin'
          and deleted_at is null
    );
$$;

create or replace function public.is_agent()
returns boolean
language sql
stable
as $$
    select exists(
        select 1
        from public.users
        where auth_id = auth.uid()
          and role = 'agent'
          and deleted_at is null
    );
$$;

-- Trigger: create profile and wallet on sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    display_name text;
    user_phone text;
    user_address text;
    user_state text;
    user_role text;
    new_user_id bigint;
begin
    display_name := coalesce(
        new.raw_user_meta_data->>'name',
        new.raw_user_meta_data->>'full_name',
        split_part(new.email, '@', 1)
    );
    user_phone := coalesce(
        new.raw_user_meta_data->>'phone',
        new.raw_user_meta_data->>'phone_number'
    );
    user_address := new.raw_user_meta_data->>'address';
    user_state := coalesce(new.raw_user_meta_data->>'state', 'Unknown');
    user_role := coalesce(new.raw_user_meta_data->>'role', 'user');

    insert into public.users (auth_id, name, email, password, phone, address, state, role)
    values (new.id, display_name, new.email, '', user_phone, user_address, user_state, user_role)
    on conflict (auth_id) do update
    set email = excluded.email;

    select id into new_user_id from public.users where auth_id = new.id;

    insert into public.wallets (user_id, balance)
    values (new_user_id, 0)
    on conflict (user_id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Submission defaults and wallet credit
create or replace function public.set_submission_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    uid bigint;
begin
    uid := public.current_user_id();
    if uid is null then
        raise exception 'Not authorized';
    end if;

    new.user_id := uid;
    new.status := coalesce(new.status, 'pending');

    if new.material_type not in ('PET', 'HDPE', 'Aluminum', 'Paper') then
        raise exception 'Invalid material';
    end if;

    if new.weight_kg is null or new.weight_kg <= 0 then
        raise exception 'Invalid weight';
    end if;

    new.payout := new.weight_kg * case new.material_type
        when 'PET' then 450
        when 'HDPE' then 420
        when 'Aluminum' then 1200
        when 'Paper' then 150
        else 0
    end;

    new.co2_saved := new.weight_kg * case new.material_type
        when 'PET' then 1.5
        when 'HDPE' then 1.8
        when 'Aluminum' then 9
        when 'Paper' then 0.8
        else 0
    end;

    return new;
end;
$$;

create or replace function public.credit_wallet_on_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.wallets
    set balance = balance + new.payout,
        updated_at = now()
    where user_id = new.user_id;

    return new;
end;
$$;

drop trigger if exists waste_submission_defaults on public.waste_submissions;
create trigger waste_submission_defaults
before insert on public.waste_submissions
for each row execute function public.set_submission_defaults();

drop trigger if exists waste_submission_wallet_credit on public.waste_submissions;
create trigger waste_submission_wallet_credit
after insert on public.waste_submissions
for each row execute function public.credit_wallet_on_submission();

-- Withdrawal validation
create or replace function public.prepare_withdrawal_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    uid bigint;
    current_balance numeric;
begin
    uid := public.current_user_id();
    if uid is null then
        raise exception 'Not authorized';
    end if;

    if new.amount is null or new.amount <= 0 then
        raise exception 'Amount and method required';
    end if;

    if new.method not in ('airtime', 'mobile_data', 'bank_transfer') then
        raise exception 'Invalid method';
    end if;

    new.user_id := uid;
    new.status := 'pending';

    select balance into current_balance
    from public.wallets
    where user_id = uid;

    if current_balance is null then
        raise exception 'Wallet not found';
    end if;

    if current_balance < new.amount then
        raise exception 'Insufficient balance';
    end if;

    update public.wallets
    set balance = balance - new.amount,
        updated_at = now()
    where user_id = uid;

    return new;
end;
$$;

drop trigger if exists withdrawal_request_defaults on public.withdrawal_requests;
create trigger withdrawal_request_defaults
before insert on public.withdrawal_requests
for each row execute function public.prepare_withdrawal_request();

-- Stats and admin functions
create or replace function public.get_public_stats()
returns table(
    total_users bigint,
    total_waste_recycled_kg numeric,
    total_co2_saved_kg numeric
)
language sql
security definer
set search_path = public
as $$
    select
        (select count(*) from public.users where role = 'user' and deleted_at is null),
        coalesce((select sum(weight_kg) from public.waste_submissions), 0),
        coalesce((select sum(co2_saved) from public.waste_submissions), 0);
$$;

create or replace function public.get_user_stats()
returns table(
    pending_submissions bigint,
    collected_submissions bigint,
    total_weight_kg numeric,
    total_co2_saved numeric,
    total_earned numeric,
    wallet_balance numeric
)
language sql
security definer
set search_path = public
as $$
    select
        count(case when ws.status = 'pending' then 1 end),
        count(case when ws.status = 'collected' then 1 end),
        coalesce(sum(case when ws.status = 'collected' then ws.weight_kg else 0 end), 0),
        coalesce(sum(case when ws.status = 'collected' then ws.co2_saved else 0 end), 0),
        coalesce(sum(case when ws.status = 'collected' then ws.payout else 0 end), 0),
        coalesce(max(w.balance), 0)
    from public.waste_submissions ws
    left join public.wallets w on ws.user_id = w.user_id
    where ws.user_id = public.current_user_id();
$$;

create or replace function public.get_leaderboard(limit_count integer default 10)
returns table(
    id bigint,
    name text,
    submission_count bigint,
    total_waste_kg numeric,
    total_co2_saved numeric
)
language sql
security definer
set search_path = public
as $$
    select
        u.id,
        u.name,
        count(ws.id) as submission_count,
        coalesce(sum(ws.weight_kg), 0) as total_waste_kg,
        coalesce(sum(ws.co2_saved), 0) as total_co2_saved
    from public.users u
    left join public.waste_submissions ws
        on u.id = ws.user_id
       and ws.status = 'collected'
    where u.role = 'user'
      and u.deleted_at is null
    group by u.id, u.name
    order by total_waste_kg desc
    limit limit_count;
$$;

create or replace function public.get_agent_stats()
returns table(
    total_collections bigint,
    total_weight_kg numeric,
    total_co2_saved numeric
)
language sql
security definer
set search_path = public
as $$
    select
        count(*),
        coalesce(sum(weight_kg), 0),
        coalesce(sum(co2_saved), 0)
    from public.waste_submissions
    where agent_id = public.current_user_id()
      and status = 'collected';
$$;

create or replace function public.get_admin_stats()
returns table(
    total_users bigint,
    total_agents bigint,
    total_admins bigint,
    total_waste_recycled_kg numeric,
    total_co2_saved_kg numeric,
    total_payouts numeric,
    pending_submissions bigint,
    pending_withdrawals bigint
)
language sql
security definer
set search_path = public
as $$
    select
        (select count(*) from public.users where role = 'user' and deleted_at is null),
        (select count(*) from public.users where role = 'agent' and deleted_at is null),
        (select count(*) from public.users where role = 'admin' and deleted_at is null),
        coalesce((select sum(weight_kg) from public.waste_submissions where status = 'collected'), 0),
        coalesce((select sum(co2_saved) from public.waste_submissions where status = 'collected'), 0),
        coalesce((select sum(payout) from public.waste_submissions where status = 'collected'), 0),
        (select count(*) from public.waste_submissions where status = 'pending'),
        (select count(*) from public.withdrawal_requests where status = 'pending');
$$;

create or replace function public.approve_withdrawal(withdrawal_id bigint, new_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    target record;
begin
    if not public.is_admin() then
        raise exception 'Not authorized';
    end if;

    if new_status not in ('approved', 'rejected') then
        raise exception 'Invalid status';
    end if;

    select * into target
    from public.withdrawal_requests
    where id = withdrawal_id
    for update;

    if not found then
        raise exception 'Withdrawal not found';
    end if;

    update public.withdrawal_requests
    set status = new_status,
        updated_at = now()
    where id = withdrawal_id;

    if new_status = 'rejected' then
        update public.wallets
        set balance = balance + target.amount,
            updated_at = now()
        where user_id = target.user_id;
    end if;
end;
$$;

-- Updated_at triggers
drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists set_wallets_updated_at on public.wallets;
create trigger set_wallets_updated_at
before update on public.wallets
for each row execute function public.set_updated_at();

drop trigger if exists set_waste_updated_at on public.waste_submissions;
create trigger set_waste_updated_at
before update on public.waste_submissions
for each row execute function public.set_updated_at();

drop trigger if exists set_withdrawals_updated_at on public.withdrawal_requests;
create trigger set_withdrawals_updated_at
before update on public.withdrawal_requests
for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.users enable row level security;
alter table public.wallets enable row level security;
alter table public.waste_submissions enable row level security;
alter table public.withdrawal_requests enable row level security;

-- Users policies
drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users
for select using (auth.uid() = auth_id);

drop policy if exists users_select_admin on public.users;
create policy users_select_admin on public.users
for select using (public.is_admin());

drop policy if exists users_insert_self on public.users;
create policy users_insert_self on public.users
for insert with check (auth.uid() = auth_id);

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
for update using (auth.uid() = auth_id)
with check (auth.uid() = auth_id);

drop policy if exists users_update_admin on public.users;
create policy users_update_admin on public.users
for update using (public.is_admin())
with check (public.is_admin());

-- Wallets policies
drop policy if exists wallets_select_owner on public.wallets;
create policy wallets_select_owner on public.wallets
for select using (user_id = public.current_user_id());

drop policy if exists wallets_select_admin on public.wallets;
create policy wallets_select_admin on public.wallets
for select using (public.is_admin());

-- Waste submissions policies
drop policy if exists waste_insert_self on public.waste_submissions;
create policy waste_insert_self on public.waste_submissions
for insert with check (user_id = public.current_user_id());

drop policy if exists waste_select_self on public.waste_submissions;
create policy waste_select_self on public.waste_submissions
for select using (
    user_id = public.current_user_id()
    or public.is_admin()
    or (public.is_agent() and (status = 'pending' or agent_id = public.current_user_id()))
);

drop policy if exists waste_update_agent_admin on public.waste_submissions;
create policy waste_update_agent_admin on public.waste_submissions
for update using (public.is_admin() or public.is_agent())
with check (public.is_admin() or public.is_agent());

-- Withdrawal policies
drop policy if exists withdrawals_insert_self on public.withdrawal_requests;
create policy withdrawals_insert_self on public.withdrawal_requests
for insert with check (user_id = public.current_user_id());

drop policy if exists withdrawals_select_self on public.withdrawal_requests;
create policy withdrawals_select_self on public.withdrawal_requests
for select using (user_id = public.current_user_id());

drop policy if exists withdrawals_select_admin on public.withdrawal_requests;
create policy withdrawals_select_admin on public.withdrawal_requests
for select using (public.is_admin());

drop policy if exists withdrawals_update_admin on public.withdrawal_requests;
create policy withdrawals_update_admin on public.withdrawal_requests
for update using (public.is_admin())
with check (public.is_admin());

-- Grants
grant execute on function public.get_public_stats() to anon, authenticated;
grant execute on function public.get_leaderboard(integer) to anon, authenticated;
grant execute on function public.get_user_stats() to authenticated;
grant execute on function public.get_agent_stats() to authenticated;
grant execute on function public.get_admin_stats() to authenticated;
grant execute on function public.approve_withdrawal(bigint, text) to authenticated;
