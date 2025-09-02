-- supabase/migrations/20240523120000_add_site_monitoring.sql

-- 1. Create monitored_sites table
CREATE TABLE IF NOT EXISTS public.monitored_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    country_code TEXT, -- ISO 3166-1 alpha-2 code
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    is_paused BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create ping_logs table
CREATE TABLE IF NOT EXISTS public.ping_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    site_id UUID NOT NULL REFERENCES public.monitored_sites(id) ON DELETE CASCADE,
    is_up BOOLEAN NOT NULL,
    response_time_ms INTEGER,
    status_code INTEGER,
    status_text TEXT,
    error_message TEXT, -- To log any errors during the fetch
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_monitored_sites_url ON public.monitored_sites(url);
CREATE INDEX IF NOT EXISTS idx_ping_logs_site_id_checked_at ON public.ping_logs(site_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_ping_logs_is_up ON public.ping_logs(is_up);


-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.monitored_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ping_logs ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow unrestricted access to monitored_sites" ON public.monitored_sites;
DROP POLICY IF EXISTS "Allow unrestricted access to ping_logs" ON public.ping_logs;

-- 6. Create RLS policies (unrestricted for now, matching existing setup)
CREATE POLICY "Allow unrestricted access to monitored_sites"
ON public.monitored_sites
FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow unrestricted access to ping_logs"
ON public.ping_logs
FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);


-- 7. Add updated_at trigger for monitored_sites
CREATE TRIGGER handle_monitored_sites_updated_at
BEFORE UPDATE ON public.monitored_sites
FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();


-- 8. Grant permissions
GRANT ALL ON public.monitored_sites TO anon, authenticated;
GRANT ALL ON public.ping_logs TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
