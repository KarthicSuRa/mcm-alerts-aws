-- Drop the overly permissive, insecure policy on the onesignal_players table.
DROP POLICY IF EXISTS "Allow unrestricted access to onesignal_players" ON public.onesignal_players;

-- Drop any lingering old policies to ensure a clean slate.
DROP POLICY IF EXISTS "Users can view their own OneSignal player ID" ON public.onesignal_players;
DROP POLICY IF EXISTS "Users can insert their own OneSignal player ID" ON public.onesignal_players;
DROP POLICY IF EXISTS "Users can update their own OneSignal player ID" ON public.onesignal_players;
DROP POLICY IF EXISTS "Users can delete their own OneSignal player ID" ON public.onesignal_players;

-- Create secure, correct policies for the onesignal_players table.
-- This ensures that users can only manage their own subscription data.

-- 1. Policy for SELECT: Users can read their own player ID.
CREATE POLICY "Allow individual user access" ON public.onesignal_players
    FOR SELECT
    USING (auth.uid() = user_id);

-- 2. Policy for INSERT: Users can create their own player ID record.
CREATE POLICY "Allow individual user insert" ON public.onesignal_players
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 3. Policy for UPDATE: Users can update their own player ID.
CREATE POLICY "Allow individual user update" ON public.onesignal_players
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. Policy for DELETE: Users can delete their own player ID.
CREATE POLICY "Allow individual user delete" ON public.onesignal_players
    FOR DELETE
    USING (auth.uid() = user_id);

-- Ensure RLS is enabled on the table, as it might have been disabled.
ALTER TABLE public.onesignal_players ENABLE ROW LEVEL SECURITY;
