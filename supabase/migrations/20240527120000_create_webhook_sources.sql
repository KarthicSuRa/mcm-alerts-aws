-- Drop the table if it exists to ensure a clean slate.
-- CASCADE will also drop dependent objects like policies.
DROP TABLE IF EXISTS public.webhook_sources CASCADE;

-- Create the table with the correct schema, including the topic_id
CREATE TABLE public.webhook_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    source_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
    CONSTRAINT webhook_sources_pkey PRIMARY KEY (id),
    CONSTRAINT webhook_sources_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE public.webhook_sources ENABLE ROW LEVEL SECURITY;

-- Create the policy for access control
CREATE POLICY "Allow users to manage their own webhook sources"
ON public.webhook_sources
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add a comment to the table for clarity
COMMENT ON TABLE public.webhook_sources IS 'Stores configuration for incoming webhooks from third-party services.';
