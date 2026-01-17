-- SAFE CLEANUP: Delete Client Auth User when Inquiry is Deleted
-- This trigger ensures that when a lawyer deletes a client card, 
-- the associated authentication account is also removed (if it's a client).

CREATE OR REPLACE FUNCTION public.delete_client_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  target_role text;
BEGIN
  -- 1. Check if there was a linked auth user
  IF OLD.client_auth_id IS NULL THEN
    RETURN OLD;
  END IF;

  -- 2. Get the role from the profile
  SELECT role INTO target_role 
  FROM public.profiles 
  WHERE id = OLD.client_auth_id;

  -- 3. SAFETY CHECK: Only delete if the user is a CLIENT.
  -- This prevents a lawyer's account from being deleted if they somehow 
  -- had an inquiry record linked to them.
  IF target_role = 'client' THEN
    RAISE NOTICE '🧹 Cleaning up client auth user: %', OLD.client_auth_id;
    DELETE FROM auth.users WHERE id = OLD.client_auth_id;
  ELSE
    RAISE NOTICE 'ℹ️ User % is a % - skipping auth cleanup.', OLD.client_auth_id, target_role;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach the trigger
DROP TRIGGER IF EXISTS on_inquiry_delete_cleanup ON public.inquiries;

CREATE TRIGGER on_inquiry_delete_cleanup
AFTER DELETE ON public.inquiries
FOR EACH ROW
EXECUTE FUNCTION public.delete_client_auth_user();
