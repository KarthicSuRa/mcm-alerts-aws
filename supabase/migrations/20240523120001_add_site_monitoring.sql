
-- Create monitored_sites table
CREATE TABLE IF NOT EXISTS public.monitored_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    region TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ping_logs table
CREATE TABLE IF NOT EXISTS public.ping_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    site_id UUID NOT NULL REFERENCES public.monitored_sites(id) ON DELETE CASCADE,
    is_up BOOLEAN NOT NULL,
    response_time_ms INTEGER,
    status_code INTEGER,
    status_text TEXT,
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_monitored_sites_name ON public.monitored_sites(name);
CREATE INDEX IF NOT EXISTS idx_ping_logs_site_id_checked_at ON public.ping_logs(site_id, checked_at DESC);

-- Enable RLS
ALTER TABLE public.monitored_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ping_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies - unrestricted access for now
CREATE POLICY "Allow public read access to monitored_sites" ON public.monitored_sites
    FOR SELECT USING (true);

CREATE POLICY "Allow full access for authenticated users on monitored_sites" ON public.monitored_sites
    FOR ALL USING (auth.role() = ''authenticated'');

CREATE POLICY "Allow public read access to ping_logs" ON public.ping_logs
    FOR SELECT USING (true);

CREATE POLICY "Allow full access for authenticated users on ping_logs" ON public.ping_logs
    FOR ALL USING (auth.role() = ''authenticated'');
    
-- Triggers for updated_at
CREATE TRIGGER handle_monitored_sites_updated_at BEFORE UPDATE ON public.monitored_sites
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Grant permissions
GRANT ALL ON public.monitored_sites TO anon, authenticated;
GRANT ALL ON public.ping_logs TO anon, authenticated;
