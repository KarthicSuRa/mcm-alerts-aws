-- Migration to automatically create a notification when a monitored site goes down.

BEGIN;

-- 1. Create the trigger function that will be executed.
CREATE OR REPLACE FUNCTION public.create_notification_on_site_down()
RETURNS TRIGGER AS $$
DECLARE
  site_name_var TEXT;
  server_alerts_topic_id_var UUID;
BEGIN
  -- Only proceed if the new log entry indicates the site is DOWN.
  IF NEW.is_up = false THEN
    -- Get the name of the monitored site from the site_id in the new ping_log record.
    SELECT name INTO site_name_var
    FROM public.monitored_sites
    WHERE id = NEW.site_id;

    -- Get the ID of the 'Server Alerts' topic.
    -- This is a critical topic that we assume exists (it is seeded in a previous migration).
    SELECT id INTO server_alerts_topic_id_var
    FROM public.topics
    WHERE name = 'Server Alerts'
    LIMIT 1;

    -- If we successfully found the site name and the topic ID, proceed to create the notification.
    IF site_name_var IS NOT NULL AND server_alerts_topic_id_var IS NOT NULL THEN
      INSERT INTO public.notifications (title, message, severity, type, site, topic_id)
      VALUES (
        'Site Down Alert: ' || site_name_var, -- e.g., 'Site Down Alert: MCM UK (English)'
        'The monitored site "' || site_name_var || '" was detected as down at ' || TO_CHAR(NEW.checked_at, 'YYYY-MM-DD HH24:MI:SS UTC') || '. Error: ' || COALESCE(NEW.error_message, 'No error details provided.'),
        'high', -- This is a high-priority event.
        'site_alert', -- A custom type for filtering.
        site_name_var, -- Storing the site name directly for easy access.
        server_alerts_topic_id_var -- Linking to the correct topic.
      );
    END IF;
  END IF;

  -- Return the new log entry to complete the INSERT operation.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- NOTE: SECURITY DEFINER is used to ensure this function runs with the permissions of the user who defined it (the database admin),
-- allowing it to insert into `public.notifications` regardless of the role that caused the insert into `ping_logs` (e.g., the cron job role).

-- 2. Create the trigger that will fire the function.
-- We use `DROP TRIGGER IF EXISTS` to make this migration script safe to re-run.
DROP TRIGGER IF EXISTS trigger_create_notification_on_site_down ON public.ping_logs;

CREATE TRIGGER trigger_create_notification_on_site_down
  AFTER INSERT ON public.ping_logs -- The trigger fires after a new record is successfully inserted.
  FOR EACH ROW -- It runs for every single row that is inserted.
  EXECUTE FUNCTION public.create_notification_on_site_down();

COMMENT ON FUNCTION public.create_notification_on_site_down IS 'Automatically creates a high-priority notification when a new ping_log entry indicates a site is down.';
COMMENT ON TRIGGER trigger_create_notification_on_site_down ON public.ping_logs IS 'After a new ping log is inserted, this trigger checks if the site is down and creates a notification if it is.';

COMMIT;
