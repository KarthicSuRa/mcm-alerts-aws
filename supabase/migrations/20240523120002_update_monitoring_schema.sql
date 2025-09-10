-- 0. Ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Drop and recreate tables to ensure correct structure
DROP TABLE IF EXISTS public.ping_logs CASCADE;
DROP TABLE IF EXISTS public.monitored_sites CASCADE;

-- 1. Tables (updated to match INSERT data)
CREATE TABLE IF NOT EXISTS public.monitored_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    country TEXT,
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    is_paused BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ping_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    site_id UUID NOT NULL REFERENCES public.monitored_sites(id) ON DELETE CASCADE,
    is_up BOOLEAN NOT NULL,
    response_time_ms INTEGER,
    status_code INTEGER,
    status_text TEXT,
    error_message TEXT,
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_monitored_sites_name
    ON public.monitored_sites(name);

CREATE INDEX IF NOT EXISTS idx_monitored_sites_country
    ON public.monitored_sites(country);

CREATE INDEX IF NOT EXISTS idx_monitored_sites_is_paused
    ON public.monitored_sites(is_paused);

CREATE INDEX IF NOT EXISTS idx_ping_logs_site_id_checked_at
    ON public.ping_logs(site_id, checked_at DESC);

-- 3. RLS enable
ALTER TABLE public.monitored_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ping_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
CREATE POLICY "public read monitored_sites"
    ON public.monitored_sites
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "auth full access monitored_sites"
    ON public.monitored_sites
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "public read ping_logs"
    ON public.ping_logs
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "auth full access ping_logs"
    ON public.ping_logs
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- 5. Helper function for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 6. Trigger
DROP TRIGGER IF EXISTS handle_monitored_sites_updated_at
    ON public.monitored_sites;

CREATE TRIGGER handle_monitored_sites_updated_at
    BEFORE UPDATE ON public.monitored_sites
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 7. Permissions (SECURED)
-- Grant read-only access to anon and authenticated
GRANT SELECT ON public.monitored_sites TO anon, authenticated;
GRANT SELECT ON public.ping_logs TO anon, authenticated;

-- Grant write permissions to authenticated users only
GRANT INSERT, UPDATE, DELETE ON public.monitored_sites TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ping_logs TO authenticated;

-- 8. Insert the updated MCM sites data
INSERT INTO public.monitored_sites (name, url, country, latitude, longitude) VALUES
('MCM AU (English)', 'https://au.mcmworldwide.com/en_AU/home', 'AU', -33.8688, 151.2093),
('MCM AT (English)', 'https://at.mcmworldwide.com/en_AT/home', 'AT', 48.2082, 16.3738),
('MCM AT (German)', 'https://at.mcmworldwide.com/de_AT/home', 'AT', 48.2082, 16.3738),
('MCM BE (English)', 'https://be.mcmworldwide.com/en_BE/home', 'BE', 50.8503, 4.3517),
('MCM CA (English)', 'https://ca.mcmworldwide.com/en_CA/home', 'CA', 45.4215, -75.6972),
('MCM CN (Chinese)', 'https://cn.mcmworldwide.com/zh_CN/home', 'CN', 39.9042, 116.4074),
('MCM CN (English)', 'https://cn.mcmworldwide.com/en_CN/home', 'CN', 39.9042, 116.4074),
('MCM CZ (English)', 'https://cz.mcmworldwide.com/en_CZ/home', 'CZ', 50.0755, 14.4378),
('MCM DK (English)', 'https://dk.mcmworldwide.com/en_DK/home', 'DK', 55.6761, 12.5683),
('MCM FI (English)', 'https://fi.mcmworldwide.com/en_FI/home', 'FI', 60.1699, 24.9384),
('MCM FR (English)', 'https://fr.mcmworldwide.com/en_FR/home', 'FR', 48.8566, 2.3522),
('MCM FR (French)', 'https://fr.mcmworldwide.com/fr_FR/home', 'FR', 48.8566, 2.3522),
('MCM DE (English)', 'https://de.mcmworldwide.com/en_DE/home', 'DE', 52.5200, 13.4050),
('MCM DE (German)', 'https://de.mcmworldwide.com/de_DE/home', 'DE', 52.5200, 13.4050),
('MCM GR (English)', 'https://gr.mcmworldwide.com/en_GR/home', 'GR', 37.9755, 23.7348),
('MCM HK (English)', 'https://hk.mcmworldwide.com/en_HK/home', 'HK', 22.3193, 114.1694),
('MCM HK (Chinese)', 'https://hk.mcmworldwide.com/zh_HK/home', 'HK', 22.3193, 114.1694),
('MCM IT (English)', 'https://it.mcmworldwide.com/en_IT/home', 'IT', 41.9028, 12.4964),
('MCM JP (English)', 'https://jp.mcmworldwide.com/en_JP/home', 'JP', 35.6895, 139.6917),
('MCM JP (Japanese)', 'https://jp.mcmworldwide.com/ja_JP/home', 'JP', 35.6895, 139.6917),
('MCM KR (Korean)', 'https://kr.mcmworldwide.com/ko_KR/home', 'KR', 37.5665, 126.9780),
('MCM LU (English)', 'https://lu.mcmworldwide.com/en_LU/home', 'LU', 49.8153, 6.1296),
('MCM MY (English)', 'https://my.mcmworldwide.com/en_MY/home', 'MY', 4.2105, 101.9758),
('MCM NZ (English)', 'https://nz.mcmworldwide.com/en_NZ/home', 'NZ', -40.9006, 174.8860),
('MCM PL (English)', 'https://pl.mcmworldwide.com/en_PL/home', 'PL', 52.2297, 21.0122),
('MCM PT (English)', 'https://pt.mcmworldwide.com/en_PT/home', 'PT', 38.7223, -9.1393),
('MCM SG (English)', 'https://sg.mcmworldwide.com/en_SG/home', 'SG', 1.3521, 103.8198),
('MCM ES (English)', 'https://es.mcmworldwide.com/en_ES/home', 'ES', 40.4168, -3.7038),
('MCM SE (English)', 'https://se.mcmworldwide.com/en_SE/home', 'SE', 59.3293, 18.0686),
('MCM CH (English)', 'https://ch.mcmworldwide.com/en_CH/home', 'CH', 46.8182, 8.2275),
('MCM CH (French)', 'https://ch.mcmworldwide.com/fr_CH/home', 'CH', 46.8182, 8.2275),
('MCM CH (German)', 'https://ch.mcmworldwide.com/de_CH/home', 'CH', 46.8182, 8.2275),
('MCM TW (English)', 'https://tw.mcmworldwide.com/en_TW/home', 'TW', 23.6978, 120.9605),
('MCM TW (Chinese)', 'https://tw.mcmworldwide.com/zh_TW/home', 'TW', 23.6978, 120.9605),
('MCM TH (English)', 'https://th.mcmworldwide.com/en_TH/home', 'TH', 13.7563, 100.5018),
('MCM TH (Thai)', 'https://th.mcmworldwide.com/th_TH/home', 'TH', 13.7563, 100.5018),
('MCM NL (English)', 'https://nl.mcmworldwide.com/en_NL/home', 'NL', 52.3676, 4.9041),
('MCM UK (English)', 'https://uk.mcmworldwide.com/en_GB/home', 'GB', 51.5074, -0.1278),
('MCM US (English)', 'https://us.mcmworldwide.com/en_US/home', 'US', 38.9072, -77.0369)
ON CONFLICT (url) DO NOTHING;
