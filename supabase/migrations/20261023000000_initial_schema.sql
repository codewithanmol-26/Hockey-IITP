-- =====================================================================
-- IIT Patna Hockey Database Migration: Firebase Firestore to Supabase
-- Version: 20261023000000_initial_schema.sql
-- Description: Complete schema supporting all 21 collections with RLS
-- =====================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PLAYERS TABLE
CREATE TABLE IF NOT EXISTS public.players (
    id TEXT PRIMARY KEY,                       -- Roll number (e.g. '2401PH07', '2501CE69')
    n INTEGER DEFAULT 0,                      -- Roster display ordering
    name TEXT NOT NULL,
    roll TEXT,                                -- Roll number (mirrors id for queries)
    position TEXT,
    joined DATE,                              -- Date joined (YYYY-MM-DD)
    size TEXT,
    contact TEXT,
    jersey_name TEXT,
    email TEXT,
    jersey_no TEXT,
    photo TEXT,                               -- Base64 data URL (<60KB)
    removed BOOLEAN DEFAULT FALSE,            -- Soft-delete flag
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_players_roll ON public.players(roll);
CREATE INDEX IF NOT EXISTS idx_players_removed ON public.players(removed);

-- 2. ACCOUNTS (Player credentials - salt + scrypt hash)
CREATE TABLE IF NOT EXISTS public.accounts (
    player_id TEXT PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
    salt TEXT NOT NULL,
    hash TEXT NOT NULL,
    created_at BIGINT,                        -- Millisecond timestamp from Firebase
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ADMINS (Admin accounts - salt + scrypt hash)
CREATE TABLE IF NOT EXISTS public.admins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    disabled BOOLEAN DEFAULT FALSE,
    salt TEXT NOT NULL,
    hash TEXT NOT NULL,
    photo TEXT,
    kind TEXT,
    player_id TEXT REFERENCES public.players(id) ON DELETE SET NULL,
    created_at BIGINT
);

-- 4. SESSIONS (Day-wise attendance records)
CREATE TABLE IF NOT EXISTS public.sessions (
    date DATE PRIMARY KEY,                    -- Session date (YYYY-MM-DD)
    r JSONB NOT NULL DEFAULT '{}'::jsonb,     -- Map: { [rollNumber]: boolean }
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_date ON public.sessions(date DESC);

-- 5. LEGACY ATTENDANCE (Monthly historical attendance totals)
CREATE TABLE IF NOT EXISTS public.legacy_attendance (
    month TEXT PRIMARY KEY,                   -- Month (YYYY-MM)
    days INTEGER NOT NULL DEFAULT 0,          -- Working days in month
    att JSONB NOT NULL DEFAULT '{}'::jsonb,   -- Map: { [rollNumber]: daysAttended }
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PRACTICE PLANS (Playing days and upcoming practice sessions)
CREATE TABLE IF NOT EXISTS public.practice_plans (
    date DATE PRIMARY KEY,                    -- Practice date (YYYY-MM-DD)
    time TEXT,                                -- Timing (e.g. "5:30–7:30 AM")
    venue TEXT,
    note TEXT,
    status TEXT DEFAULT 'planned',            -- 'planned', 'cancelled', 'completed'
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_plans_date ON public.practice_plans(date ASC);

-- 7. PLAYER AVAILABILITY (Player RSVP for upcoming playing days)
CREATE TABLE IF NOT EXISTS public.player_availability (
    date DATE PRIMARY KEY,                    -- Target practice date
    r JSONB NOT NULL DEFAULT '{}'::jsonb,     -- Map: { [rollNumber]: statusCode (1=coming, 2=injured, 3=cannot) }
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. HOCKEY RULES (Official rules and umpire signals)
CREATE TABLE IF NOT EXISTS public.hockey_rules (
    id TEXT PRIMARY KEY,                       -- e.g. 's01', 's02'
    title TEXT NOT NULL,
    icon TEXT,
    order_index INTEGER DEFAULT 0,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of { h, b, img, yt }
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hockey_rules_order ON public.hockey_rules(order_index ASC);

-- 9. WARMUP DRILLS (Stretching and warmup routines)
CREATE TABLE IF NOT EXISTS public.warmup_drills (
    id TEXT PRIMARY KEY,                       -- e.g. 'w1', 'w2'
    title TEXT NOT NULL,
    icon TEXT,
    order_index INTEGER DEFAULT 0,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of { h, b, img, yt }
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warmup_order ON public.warmup_drills(order_index ASC);

-- 10. APP CONFIGURATION (Schedule, templates, staff names, links)
CREATE TABLE IF NOT EXISTS public.app_config (
    key TEXT PRIMARY KEY,                      -- 'schedule', 'template', 'staffNames', 'groupPhoto', 'matches', 'group', 'staff'
    value JSONB NOT NULL,                      -- Document content
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. BLOBS (Base64 media items: groupPhoto, cover photos)
CREATE TABLE IF NOT EXISTS public.blobs (
    id TEXT PRIMARY KEY,                       -- 'groupPhoto', 'cover_p_<roll>', 'cover_a_<id>', etc.
    img TEXT NOT NULL,                         -- Base64 data URL
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. GALLERY (Team photos, thumbnails & full resolution)
CREATE TABLE IF NOT EXISTS public.gallery (
    id TEXT PRIMARY KEY,
    thumb TEXT NOT NULL,                       -- Thumbnail base64
    full_img TEXT,                             -- Full image base64
    by_name TEXT,
    user_key TEXT,                             -- 'p:<roll>', 'a:<id>', or role
    cat TEXT DEFAULT 'practice',               -- 'fitness', 'practice', 'match'
    description TEXT,
    created_at BIGINT                          -- Millisecond timestamp
);

CREATE INDEX IF NOT EXISTS idx_gallery_created_at ON public.gallery(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_cat ON public.gallery(cat);

-- 13. HEALTH LOGS (Player personal health entries)
CREATE TABLE IF NOT EXISTS public.health_logs (
    id TEXT PRIMARY KEY,                       -- Format: 'p:<roll>_<date>'
    user_key TEXT NOT NULL,                    -- 'p:<roll>'
    log_date DATE NOT NULL,
    steps INTEGER,
    km NUMERIC(6, 2),
    sleep NUMERIC(4, 1),
    kcal INTEGER,
    height NUMERIC(5, 1),
    weight NUMERIC(5, 1),
    recorded_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_health_user_date ON public.health_logs(user_key, log_date DESC);

-- 14. PUSH SUBSCRIPTIONS (Web Push notification endpoints)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    endpoint_hash TEXT PRIMARY KEY,
    sub JSONB NOT NULL,                        -- { endpoint, keys: { p256dh, auth } }
    role TEXT,
    uid TEXT,
    created_at BIGINT
);

-- 15. ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS public.announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    pinned BOOLEAN DEFAULT FALSE,
    by_name TEXT,
    role TEXT,
    created_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_announcements_created ON public.announcements(created_at DESC);

-- 16. BUG REPORTS
CREATE TABLE IF NOT EXISTS public.bug_reports (
    id TEXT PRIMARY KEY,
    desc_text TEXT,
    shot TEXT,                                 -- Screenshot base64
    by_name TEXT,
    role TEXT,
    status TEXT DEFAULT 'open',
    created_at BIGINT
);

-- 17. HELP MESSAGES
CREATE TABLE IF NOT EXISTS public.help_messages (
    id TEXT PRIMARY KEY,
    name TEXT,
    roll TEXT,
    contact TEXT,
    topic TEXT,
    msg TEXT,
    done BOOLEAN DEFAULT FALSE,
    created_at BIGINT
);

-- 18. WORKOUTS
CREATE TABLE IF NOT EXISTS public.workouts (
    id TEXT PRIMARY KEY,
    title TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    created_at BIGINT
);

-- 19. SIGNUP TRIES (Rate limiting)
CREATE TABLE IF NOT EXISTS public.signup_tries (
    roll TEXT PRIMARY KEY,
    tries INTEGER DEFAULT 0,
    locked_until BIGINT DEFAULT 0
);

-- 20. LOGIN OTPS
CREATE TABLE IF NOT EXISTS public.login_otps (
    id TEXT PRIMARY KEY,
    hash TEXT NOT NULL,
    created_at BIGINT
);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hockey_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warmup_drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_tries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_otps ENABLE ROW LEVEL SECURITY;

-- 1. Full access for server-side service role
CREATE POLICY "Service role full access on players" ON public.players FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on accounts" ON public.accounts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on admins" ON public.admins FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on sessions" ON public.sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on legacy" ON public.legacy_attendance FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on practice_plans" ON public.practice_plans FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on availability" ON public.player_availability FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on rules" ON public.hockey_rules FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on warmup" ON public.warmup_drills FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on config" ON public.app_config FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on blobs" ON public.blobs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on gallery" ON public.gallery FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on health" ON public.health_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on push" ON public.push_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on announcements" ON public.announcements FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on bugs" ON public.bug_reports FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on help" ON public.help_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on workouts" ON public.workouts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on signup_tries" ON public.signup_tries FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on otps" ON public.login_otps FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Public read policies for shared data (rules, warmup, schedule, public plans)
CREATE POLICY "Public read hockey_rules" ON public.hockey_rules FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read warmup_drills" ON public.warmup_drills FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read practice_plans" ON public.practice_plans FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read app_config" ON public.app_config FOR SELECT TO anon, authenticated USING (key IN ('schedule', 'staffNames', 'matches', 'groupPhoto', 'group'));

-- 3. Security: Accounts and Admin credentials NEVER accessible to anon
-- (accounts & admins have NO policies for anon, so SELECT is blocked by default under RLS)
