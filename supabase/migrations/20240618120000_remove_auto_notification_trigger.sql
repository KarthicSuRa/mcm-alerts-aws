-- Migration to remove the automatic notification trigger and function.

BEGIN;

-- 1. Drop the trigger from the ping_logs table.
-- Using `IF EXISTS` makes the script safe to re-run even if the trigger is already gone.
DROP TRIGGER IF EXISTS trigger_create_notification_on_site_down ON public.ping_logs;

-- 2. Drop the function that the trigger used to call.
DROP FUNCTION IF EXISTS public.create_notification_on_site_down();

COMMIT;
