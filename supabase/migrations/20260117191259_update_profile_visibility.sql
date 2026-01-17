-- 1. Add assigned_lawyer_id to profiles to clarify relationships
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'assigned_lawyer_id') THEN
        ALTER TABLE public.profiles ADD COLUMN assigned_lawyer_id UUID REFERENCES public.profiles(id);
    END IF;
END $$;

-- 2. Create or Update the trigger to populate assigned_lawyer_id derived from inquiries
CREATE OR REPLACE FUNCTION public.sync_assigned_lawyer()
RETURNS TRIGGER AS $$
DECLARE
    found_lawyer_id UUID;
BEGIN
    -- Check if the profile is a client
    IF NEW.role = 'client' THEN
        -- 1. Find the lawyer ID candidate from inquiries
        SELECT assigned_lawyer_id INTO found_lawyer_id
        FROM public.inquiries 
        WHERE client_auth_id = NEW.id 
        OR contact_email = NEW.email
        LIMIT 1;

        -- 2. ONLY proceed if the lawyer exists in profiles (prevents FK violation)
        IF found_lawyer_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = found_lawyer_id) THEN
            UPDATE public.profiles
            SET assigned_lawyer_id = found_lawyer_id
            WHERE id = NEW.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach trigger to profiles
DROP TRIGGER IF EXISTS on_client_created_sync_lawyer ON public.profiles;
CREATE TRIGGER on_client_created_sync_lawyer
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_assigned_lawyer();

-- 4. Initial sync for existing clients
UPDATE public.profiles p
SET assigned_lawyer_id = (
    SELECT assigned_lawyer_id 
    FROM public.inquiries i 
    WHERE i.client_auth_id = p.id 
    OR i.contact_email = p.email
    LIMIT 1
)
WHERE p.role = 'client' AND p.assigned_lawyer_id IS NULL;
