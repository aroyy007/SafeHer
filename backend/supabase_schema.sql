-- ============================================================
-- SafeHer — Supabase Schema
-- ============================================================
-- Run this entire script in:
--   Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- This script is IDEMPOTENT: it uses `IF NOT EXISTS` everywhere, so
-- re-running it won't break an existing setup. Safe to run multiple
-- times during development.
--
-- After this script succeeds:
--   1. Supabase Dashboard → Authentication → Providers
--      Enable Email (already on by default)
--   2. Project Settings → API → copy the publishable key + service
--      role key + JWT secret into backend/.env
--   3. Set USE_SUPABASE=true in backend/.env (and on Render)
--   4. The backend's `db.supabase_client.get_supabase_admin()` will
--      start writing real rows instead of falling back to SQLite.
-- ============================================================


-- ============================================================
-- 0. Extensions
-- ============================================================
-- pgcrypto gives us gen_random_uuid() (uuid_generate_v4 alternative).
create extension if not exists "pgcrypto";


-- ============================================================
-- 1. USERS
-- ============================================================
-- Mirrors the local SQLite `users` table 1-to-1. Backend stores
-- the row directly via service-role key on signup.
--
-- We deliberately do NOT use Supabase Auth's `auth.users` as our
-- primary user table because:
--   - The backend owns password hashing (PBKDF2-HMAC-SHA256, 200k iters)
--   - The frontend signup flow does NOT use Supabase Auth — it creates
--     a user row directly via POST /auth/signup.
--   - We want full control over schema (home_area, photo_url, phone_verified).
create table if not exists public.users (
    id              text primary key,                       -- uuid v4 string
    name            text not null,
    email           text unique not null,
    phone           text,                                   -- free-form, not verified
    password_hash   text not null,                          -- "pbkdf2$<iters>$<salt>$<hash>"
    home_area       text default '',                        -- neighborhood, e.g. "Halishahar"
    photo_url       text default '',                        -- public Firebase Storage URL
    phone_verified  boolean default false,
    created_at      timestamptz not null default now()
);

create index if not exists idx_users_email on public.users (lower(email));


-- ============================================================
-- 2. EMERGENCY CONTACTS
-- ============================================================
-- Trusted-circle contacts owned by a user. Currently exposed via
-- /auth/contacts endpoints. The circles table (below) is the newer
-- model; this one is kept for backwards compatibility.
create table if not exists public.emergency_contacts (
    id          text primary key,
    user_id     text not null references public.users(id) on delete cascade,
    name        text not null,
    phone       text not null,
    email       text default '',
    relation    text default 'Friend',
    created_at  timestamptz not null default now()
);

create index if not exists idx_contacts_user on public.emergency_contacts (user_id);


-- ============================================================
-- 3. INCIDENTS (community reports)
-- ============================================================
-- Anonymous community-reported incidents. Used by the heatmap
-- and by /incidents/nearby. Anonymous rows omit a user_id.
create table if not exists public.incidents (
    id           text primary key,
    user_id      text references public.users(id) on delete set null,
    lat          double precision not null,
    lng          double precision not null,
    category     text not null,                 -- harassment|assault|theft|stalking|other
    description  text,
    time_of_day  text,                          -- morning|afternoon|evening|night
    anonymous    boolean default false,
    created_at   timestamptz not null default now()
);

create index if not exists idx_incidents_loc      on public.incidents (lat, lng);
create index if not exists idx_incidents_created  on public.incidents (created_at desc);


-- ============================================================
-- 4. SOS LOGS (audit trail)
-- ============================================================
-- Every SOS activation is recorded here for the heatmap and for
-- post-incident analysis. The frontend posts here as fire-and-forget.
create table if not exists public.sos_logs (
    id          bigserial primary key,
    session_id  text not null,
    user_id     text references public.users(id) on delete set null,
    lat         double precision,
    lng         double precision,
    trigger_method text,                        -- button_hold|voice_command|disguise_mode|test
    lang_at_trigger text default 'unknown',
    payload     jsonb default '{}'::jsonb,      -- full event JSON for forensics
    created_at  timestamptz not null default now()
);

create index if not exists idx_sos_user    on public.sos_logs (user_id, created_at desc);
create index if not exists idx_sos_session on public.sos_logs (session_id);


-- ============================================================
-- 5. CIRCLES (trusted-circle groups, v2 model)
-- ============================================================
-- Newer, more structured version of emergency_contacts: a user
-- can have multiple named circles (Family, Work, Roommates) with
-- distinct members in each. Used by the /circles endpoints.
create table if not exists public.circles (
    id          text primary key,
    owner_id    text not null references public.users(id) on delete cascade,
    name        text not null,
    color       text default '#FF4D6D',
    created_at  timestamptz not null default now()
);

create index if not exists idx_circles_owner on public.circles (owner_id);


create table if not exists public.circle_members (
    id          text primary key,
    circle_id   text not null references public.circles(id) on delete cascade,
    name        text not null,
    contact     text not null,                  -- phone, email, or other handle
    relation    text,
    created_at  timestamptz not null default now()
);

create index if not exists idx_members_circle on public.circle_members (circle_id);


-- ============================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================
-- The backend uses the SERVICE ROLE key, which bypasses RLS, so
-- most policies below don't gate backend writes. They DO matter
-- if you ever wire the frontend directly to Supabase with the
-- anon key (e.g. for live circle updates via Supabase Realtime).
--
-- Policy philosophy: users can only read/write rows they own.
-- Anonymous incident reports are world-readable so the heatmap
-- works for everyone.

-- ----- users -----
alter table public.users enable row level security;

drop policy if exists users_self_read on public.users;
create policy users_self_read on public.users
    for select using (auth.uid()::text = id);

drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users
    for update using (auth.uid()::text = id);

-- INSERT/DELETE for users are intentionally NOT allowed via anon key.
-- The backend handles those via service-role.

-- ----- emergency_contacts -----
alter table public.emergency_contacts enable row level security;

drop policy if exists contacts_owner_all on public.emergency_contacts;
create policy contacts_owner_all on public.emergency_contacts
    for all using (user_id = auth.uid()::text)
    with check (user_id = auth.uid()::text);

-- ----- incidents -----
alter table public.incidents enable row level security;

-- Anyone can read non-deleted incidents (for the public heatmap)
drop policy if exists incidents_public_read on public.incidents;
create policy incidents_public_read on public.incidents
    for select using (true);

-- Anonymous users can report incidents (no auth.uid() check needed;
-- they just leave user_id null)
drop policy if exists incidents_anon_insert on public.incidents;
create policy incidents_anon_insert on public.incidents
    for insert with check (
        anonymous = true
        or auth.uid()::text = user_id
    );

-- ----- sos_logs -----
alter table public.sos_logs enable row level security;

drop policy if exists sos_self_read on public.sos_logs;
create policy sos_self_read on public.sos_logs
    for select using (user_id = auth.uid()::text);

-- ----- circles -----
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;

drop policy if exists circles_owner_all on public.circles;
create policy circles_owner_all on public.circles
    for all using (owner_id = auth.uid()::text)
    with check (owner_id = auth.uid()::text);

drop policy if exists members_via_circle on public.circle_members;
create policy members_via_circle on public.circle_members
    for all using (
        circle_id in (select id from public.circles where owner_id = auth.uid()::text)
    )
    with check (
        circle_id in (select id from public.circles where owner_id = auth.uid()::text)
    );


-- ============================================================
-- 7. GRANTS (so the anon role can use the policies above)
-- ============================================================
-- The backend uses the service-role key (bypasses RLS). The anon
-- role (browser) only needs read on incidents for the heatmap
-- and read/write on a user's own rows.
grant usage on schema public to anon, authenticated;

grant select on public.incidents    to anon, authenticated;
grant select, update on public.users to authenticated;

grant select, insert, update, delete on public.emergency_contacts to authenticated;
grant select, insert                on public.incidents          to anon, authenticated;

grant select, insert, update, delete on public.circles        to authenticated;
grant select, insert, update, delete on public.circle_members to authenticated;
grant select                         on public.sos_logs        to authenticated;

-- sequences (for sos_logs bigserial)
grant usage, select on sequence public.sos_logs_id_seq to authenticated;


-- ============================================================
-- 8. HELPFUL VIEWS (optional, for analytics dashboards)
-- ============================================================

-- Recent SOS activations per area (for the post-incident heatmap)
create or replace view public.recent_sos_by_area as
select
    date_trunc('hour', created_at) as hour_bucket,
    count(*)                       as activations,
    round(avg(lat)::numeric, 4)    as avg_lat,
    round(avg(lng)::numeric, 4)    as avg_lng
from public.sos_logs
where created_at > now() - interval '7 days'
group by 1
order by 1 desc;

-- Incidents by category (last 30 days)
create or replace view public.incidents_by_category_30d as
select
    category,
    count(*) as total,
    count(*) filter (where anonymous) as anonymous_total
from public.incidents
where created_at > now() - interval '30 days'
group by category
order by total desc;


-- ============================================================
-- 9. DONE
-- ============================================================
-- Sanity check (run these manually if you want):
--
--   \dt                  -- list tables
--   \dv                  -- list views
--   select * from incidents limit 1;   -- empty result is fine
--
-- Then update backend/.env:
--   USE_SUPABASE=true
--   SUPABASE_URL=https://yeodkyxfowaqmmugbdmv.supabase.co
--   SUPABASE_KEY=sb_publishable_T-6SCoxtcecIDyfbDvhpqA_Y0a1o8Wn
--   SUPABASE_SERVICE_KEY=<service-role key from Settings → API>
--   SUPABASE_JWT_SECRET=<JWT Secret from Settings → API>
--
-- Restart the backend and hit POST /auth/signup — the row should
-- appear in the Supabase Table Editor.