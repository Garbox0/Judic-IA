-- 1. Ensure columns exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'assigned_lawyer_id') THEN
        ALTER TABLE public.profiles ADD COLUMN assigned_lawyer_id UUID REFERENCES public.profiles(id);
    END IF;
END $$;

-- 2. BETTER ROLE VISIBILITY (RLS)
-- Allow lawyers to see profiles of users assigned to them
DROP POLICY IF EXISTS "Lawyers can view their clients" ON public.profiles;
CREATE POLICY "Lawyers can view their clients"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    auth.uid() = id -- Can see self
    OR 
    auth.uid() = assigned_lawyer_id -- Can see clients
    OR
    role = 'lawyer' -- Can see other lawyers (Public profiles)
);

-- 3. BI-DIRECTIONAL SYNC TRIGGER
-- Trigger on INQUIRIES to update the CLIENT'S profile when an inquiry is created/updated
CREATE OR REPLACE FUNCTION public.sync_lawyer_to_client_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- If we have both a client auth id and a lawyer id
    IF NEW.client_auth_id IS NOT NULL AND NEW.assigned_lawyer_id IS NOT NULL THEN
        UPDATE public.profiles
        SET assigned_lawyer_id = NEW.assigned_lawyer_id
        WHERE id = NEW.client_auth_id
        AND (assigned_lawyer_id IS NULL OR assigned_lawyer_id != NEW.assigned_lawyer_id);
    END IF;
    
    -- Also sync by email if auth_id is missing but email matches
    IF NEW.client_auth_id IS NULL AND NEW.contact_email IS NOT NULL AND NEW.assigned_lawyer_id IS NOT NULL THEN
        UPDATE public.profiles
        SET assigned_lawyer_id = NEW.assigned_lawyer_id
        WHERE email = NEW.contact_email
        AND (assigned_lawyer_id IS NULL OR assigned_lawyer_id != NEW.assigned_lawyer_id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_inquiry_sync_profile ON public.inquiries;
CREATE TRIGGER on_inquiry_sync_profile
AFTER INSERT OR UPDATE ON public.inquiries
FOR EACH ROW EXECUTE FUNCTION public.sync_lawyer_to_client_profile();

-- 4. CLEANUP / INITIAL SYNC
-- Ensure all clients with an inquiry get the lawyer id in their profile
UPDATE public.profiles p
SET assigned_lawyer_id = i.assigned_lawyer_id,
    role = 'client' -- Ensure role is set
FROM public.inquiries i
WHERE (p.id = i.client_auth_id OR p.email = i.contact_email)
AND (p.role IS NULL OR p.role = 'client')
AND p.assigned_lawyer_id IS NULL 
AND i.assigned_lawyer_id IS NOT NULL;
