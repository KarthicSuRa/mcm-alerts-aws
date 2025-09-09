-- Corrected Combined Migration: Add Roles, Teams, and Full Permissions (v2)
-- This single script creates the schema and applies all RLS policies.
-- FIX: Corrected a syntax error in the topic_subscriptions policy.

BEGIN;

-- =================================================================
-- PHASE 1: Add new tables and columns for Teams & Roles
-- =================================================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT UNIQUE,
    app_role TEXT NOT NULL DEFAULT 'member' CHECK (app_role IN ('super_admin', 'admin', 'member'))
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. TEAMS & TEAM MEMBERS TABLES
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.team_members (
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    team_role TEXT NOT NULL DEFAULT 'member' CHECK (team_role IN ('admin', 'member')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (team_id, user_id)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- 3. UPDATE TOPICS TABLE
ALTER TABLE public.topics
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

-- 4. NEW USER TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. BACK-FILL EXISTING USERS
INSERT INTO public.profiles (id, email, full_name)
SELECT id, email, raw_user_meta_data->>'full_name' FROM auth.users
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles
SET app_role = 'super_admin'
WHERE email = 'bkarthic98@gmail.com';

-- =================================================================
-- PHASE 2: Helper Functions & Row-Level Security (RLS)
-- =================================================================

-- 1. HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.get_my_app_role()
RETURNS TEXT AS $$
BEGIN RETURN (SELECT app_role FROM public.profiles WHERE id = auth.uid()); END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id UUID)
RETURNS BOOLEAN AS $$
BEGIN RETURN EXISTS (SELECT 1 FROM public.team_members WHERE team_id = p_team_id AND user_id = auth.uid()); END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE OR REPLACE FUNCTION public.is_team_admin(p_team_id UUID)
RETURNS BOOLEAN AS $$
BEGIN RETURN EXISTS (SELECT 1 FROM public.team_members WHERE team_id = p_team_id AND user_id = auth.uid() AND team_role = 'admin'); END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 2. DROP OLD PERMISSIVE POLICIES
DROP POLICY IF EXISTS "Allow unrestricted access to topics" ON public.topics;
DROP POLICY IF EXISTS "Allow unrestricted access to notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow unrestricted access to user_notification_preferences" ON public.user_notification_preferences;
DROP POLICY IF EXISTS "Allow unrestricted access to topic_subscriptions" ON public.topic_subscriptions;
DROP POLICY IF EXISTS "Allow unrestricted access to comments" ON public.comments;
DROP POLICY IF EXISTS "Allow unrestricted access to onesignal_players" ON public.onesignal_players;
DROP POLICY IF EXISTS "Allow unrestricted access to push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow unrestricted access to subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "public read monitored_sites" ON public.monitored_sites;
DROP POLICY IF EXISTS "auth full access monitored_sites" ON public.monitored_sites;
DROP POLICY IF EXISTS "public read ping_logs" ON public.ping_logs;
DROP POLICY IF EXISTS "auth full access ping_logs" ON public.ping_logs;

-- 3. IMPLEMENT NEW RLS POLICIES

-- Profiles
CREATE POLICY "Super admins can manage all profiles" ON public.profiles FOR ALL USING (get_my_app_role() = 'super_admin') WITH CHECK (get_my_app_role() = 'super_admin');
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Teams
CREATE POLICY "Super admins can manage all teams" ON public.teams FOR ALL USING (get_my_app_role() = 'super_admin') WITH CHECK (get_my_app_role() = 'super_admin');
CREATE POLICY "Team admins can update their team" ON public.teams FOR UPDATE USING (is_team_admin(id)) WITH CHECK (is_team_admin(id));
CREATE POLICY "Users can view all teams" ON public.teams FOR SELECT USING (true);

-- Team Members
CREATE POLICY "Super admins can manage all team members" ON public.team_members FOR ALL USING (get_my_app_role() = 'super_admin') WITH CHECK (get_my_app_role() = 'super_admin');
CREATE POLICY "Team admins can manage their members" ON public.team_members FOR ALL USING (is_team_admin(team_id)) WITH CHECK (is_team_admin(team_id));
CREATE POLICY "Users can view their own team memberships" ON public.team_members FOR SELECT USING (is_team_member(team_id));

-- Topics
CREATE POLICY "View topics for own teams" ON public.topics FOR SELECT USING (is_team_member(team_id) OR get_my_app_role() = 'super_admin');
CREATE POLICY "Manage topics for own teams" ON public.topics FOR ALL USING (is_team_admin(team_id)) WITH CHECK (is_team_admin(team_id));
CREATE POLICY "Super admin full access to topics" ON public.topics FOR ALL USING (get_my_app_role() = 'super_admin') WITH CHECK (get_my_app_role() = 'super_admin');

-- Topic Subscriptions
CREATE POLICY "View own subscriptions" ON public.topic_subscriptions FOR SELECT USING (user_id = auth.uid());
-- CORRECTED POLICY: Split into two for INSERT and DELETE
CREATE POLICY "Allow subscription INSERT for team members" ON public.topic_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid() AND (EXISTS (SELECT 1 FROM public.topics t WHERE t.id = topic_id AND is_team_member(t.team_id))));
CREATE POLICY "Allow subscription DELETE for self" ON public.topic_subscriptions FOR DELETE USING (user_id = auth.uid());
-- END CORRECTION
CREATE POLICY "Super admin full access to topic subscriptions" ON public.topic_subscriptions FOR ALL USING (get_my_app_role() = 'super_admin') WITH CHECK (get_my_app_role() = 'super_admin');
CREATE POLICY "Team admins can view team subscriptions" ON public.topic_subscriptions FOR SELECT USING (is_team_admin((SELECT team_id FROM topics WHERE id = topic_id)));

-- Notifications
CREATE POLICY "View notifications for team topics" ON public.notifications FOR SELECT USING (is_team_member((SELECT team_id FROM public.topics WHERE id = topic_id)) OR get_my_app_role() = 'super_admin');
CREATE POLICY "Manage notifications for admin teams" ON public.notifications FOR ALL USING (is_team_admin((SELECT team_id FROM public.topics WHERE id = topic_id))) WITH CHECK (is_team_admin((SELECT team_id FROM public.topics WHERE id = topic_id)));
CREATE POLICY "Super admin full access to notifications" ON public.notifications FOR ALL USING (get_my_app_role() = 'super_admin') WITH CHECK (get_my_app_role() = 'super_admin');

-- Comments
CREATE POLICY "View comments on viewable notifications" ON public.comments FOR SELECT USING (EXISTS (SELECT 1 FROM public.notifications n WHERE n.id = notification_id));
CREATE POLICY "Manage own comments" ON public.comments FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can moderate comments in their team" ON public.comments FOR ALL USING (is_team_admin((SELECT t.team_id FROM public.topics t JOIN public.notifications n ON t.id = n.topic_id WHERE n.id = notification_id)));
CREATE POLICY "Super admin full access to comments" ON public.comments FOR ALL USING (get_my_app_role() = 'super_admin') WITH CHECK (get_my_app_role() = 'super_admin');

-- Ping Logs (Clear Logs)
CREATE POLICY "Super admins can delete ping logs" ON public.ping_logs FOR DELETE USING (get_my_app_role() = 'super_admin');
CREATE POLICY "Users can read ping logs" ON public.ping_logs FOR SELECT USING (true);
CREATE POLICY "Users can create ping logs" ON public.ping_logs FOR INSERT WITH CHECK (true);

-- User-specific tables
CREATE POLICY "Manage own preferences and subscriptions" ON public.user_notification_preferences FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Manage own OneSignal players" ON public.onesignal_players FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Manage own push subscriptions" ON public.push_subscriptions FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Monitored Sites
CREATE POLICY "Read monitored sites" ON public.monitored_sites FOR SELECT USING (true);
CREATE POLICY "Super Admins can manage monitored sites" ON public.monitored_sites FOR ALL USING (get_my_app_role() = 'super_admin') WITH CHECK (get_my_app_role() = 'super_admin');

COMMIT;
