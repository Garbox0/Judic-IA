-- ==========================================
-- JUDIC-IA: UNIFIED RLS HARDENING (V3)
-- Organization-Aware & Studio-First
-- ==========================================

-- 0. Helper Functions (Security Definer)
CREATE OR REPLACE FUNCTION public.is_org_member(org_uuid UUID)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.org_members 
    WHERE org_id = org_uuid AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. INQUIRIES: Hardening Access
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lawyers manage their inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Clients view their own inquiry" ON public.inquiries;
DROP POLICY IF EXISTS "Clients can view their own inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Clients can update their own inquiries" ON public.inquiries;

-- 1.1 Lawyer/Staff Access (Studio-Wide)
CREATE POLICY "Lawyers can manage organization inquiries" 
ON public.inquiries FOR ALL 
TO authenticated 
USING (
    assigned_lawyer_id = auth.uid() 
    OR 
    public.is_org_member(org_id)
);

-- 1.2 Client Access (Ownership & Email)
CREATE POLICY "Clients can manage own inquiries" 
ON public.inquiries FOR ALL 
TO authenticated 
USING (
    client_auth_id = auth.uid() 
    OR 
    contact_email = (auth.jwt()->>'email')
);

-- 2. MESSAGES: Cascade Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can view their own messages" ON public.messages;
DROP POLICY IF EXISTS "Clients can insert their own messages" ON public.messages;

CREATE POLICY "Access messages via inquiry ownership" 
ON public.messages FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.inquiries 
        WHERE id = messages.inquiry_id 
        AND (
            assigned_lawyer_id = auth.uid() 
            OR 
            client_auth_id = auth.uid() 
            OR 
            contact_email = (auth.jwt()->>'email')
            OR
            public.is_org_member(org_id)
        )
    )
);

-- 3. ATTACHMENTS: Cascade Security
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view relevant attachments" ON public.attachments;

CREATE POLICY "Access attachments via inquiry ownership" 
ON public.attachments FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.inquiries 
        WHERE id = attachments.inquiry_id 
        AND (
            assigned_lawyer_id = auth.uid() 
            OR 
            client_auth_id = auth.uid() 
            OR 
            contact_email = (auth.jwt()->>'email')
            OR
            public.is_org_member(org_id)
        )
    )
);

-- 4. PROFILES: Studio-Wide Visibility
-- Allow people in the same org to see each other's basic profile
DROP POLICY IF EXISTS "Org members can view profile" ON public.profiles;
CREATE POLICY "Org members can view profile" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (
    public.is_org_member(org_id)
);

-- 5. CASES: Studio-Wide Visibility
DROP POLICY IF EXISTS "Org members can view cases" ON public.cases;
CREATE POLICY "Org members can manage cases" 
ON public.cases FOR ALL 
TO authenticated 
USING (
    public.is_org_member(org_id)
);

-- 6. SYSTEM OVERRIDE: Allow public intake (Anonymous/Limited)
-- We allow INSERT for everyone on inquiries (to start a chat) 
-- BUT only if it's a NEW inquiry (status = 'link_generated' or similar)
-- Actually, the API uses SERVICE_ROLE for intake, so this is safe for now.
-- Anonymous users can only INSERT to inquiries if they have a valid flow.
-- For now, we trust the API layer for public intake bypass via service_role.
