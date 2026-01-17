-- 1. Enable RLS on tables (if not already enabled)
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies to avoid conflicts
DROP POLICY IF EXISTS "Clients can view their own inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Clients can update their own inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Clients can view their own messages" ON public.messages;
DROP POLICY IF EXISTS "Clients can insert their own messages" ON public.messages;

-- 3. Inquiries: Allow clients to view/update based on auth_id or email
CREATE POLICY "Clients can view their own inquiries"
ON public.inquiries
FOR SELECT
TO authenticated
USING (
    auth.uid() = client_auth_id 
    OR 
    contact_email = (auth.jwt()->>'email')
);

CREATE POLICY "Clients can update their own inquiries"
ON public.inquiries
FOR UPDATE
TO authenticated
USING (
    auth.uid() = client_auth_id 
    OR 
    contact_email = (auth.jwt()->>'email')
)
WITH CHECK (
    auth.uid() = client_auth_id 
    OR 
    contact_email = (auth.jwt()->>'email')
);

-- 4. Messages: Allow clients to read/write messages for inquiries they have access to
CREATE POLICY "Clients can view their own messages"
ON public.messages
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.inquiries
        WHERE inquiries.id = messages.inquiry_id
        AND (
            inquiries.client_auth_id = auth.uid()
            OR
            inquiries.contact_email = (auth.jwt()->>'email')
        )
    )
);

CREATE POLICY "Clients can insert their own messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.inquiries
        WHERE inquiries.id = messages.inquiry_id
        AND (
            inquiries.client_auth_id = auth.uid()
            OR
            inquiries.contact_email = (auth.jwt()->>'email')
        )
    )
);

-- 5. System/Demo access (Optional, keeping it safe)
-- If we want to allow public intake without auth for the first message, we might need a public policy.
-- But the user is specifically having issues AFTER login/confirmation.
