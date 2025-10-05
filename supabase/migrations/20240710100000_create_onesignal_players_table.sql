-- Create the table to store OneSignal player IDs
CREATE TABLE public.onesignal_players (
    user_id uuid NOT NULL,
    player_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT onesignal_players_pkey PRIMARY KEY (user_id),
    CONSTRAINT onesignal_players_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Add a unique constraint on player_id to prevent duplicates
ALTER TABLE public.onesignal_players
ADD CONSTRAINT onesignal_players_player_id_key UNIQUE (player_id);

-- Enable Row-Level Security
ALTER TABLE public.onesignal_players ENABLE ROW LEVEL SECURITY;

-- POLICIES --
-- Users can view their own player ID.
CREATE POLICY "Allow individual user access" ON public.onesignal_players FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own player ID.
CREATE POLICY "Allow individual user insert" ON public.onesignal_players FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own player ID.
CREATE POLICY "Allow individual user update" ON public.onesignal_players FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Users can delete their own player ID.
CREATE POLICY "Allow individual user delete" ON public.onesignal_players FOR DELETE USING (auth.uid() = user_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updated_at" = NOW();
  RETURN _new;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on row modification
CREATE TRIGGER set_public_onesignal_players_updated_at
BEFORE UPDATE ON public.onesignal_players
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

COMMENT ON TRIGGER set_public_onesignal_players_updated_at ON public.onesignal_players
IS 'trigger to set value of column "updated_at" to current timestamp on row update';
