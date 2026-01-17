-- ENABLE CASE INTERACTIONS (DELETE & UPLOAD)

-- 1. UTILITY: Safe Membership Check (using existing function)
-- Relies on public._check_org_membership(_org_id) created previously.

-- 2. ENABLE DELETE ON CASES
-- Only Organization Owners or the Assigned Lawyer can delete a case.
DROP POLICY IF EXISTS "Org members can delete cases" ON public.cases;
CREATE POLICY "Org members can delete cases" ON public.cases
    FOR DELETE USING (
        _check_org_membership(org_id) -- Basic membership check
        AND (
            assigned_to = auth.uid() -- It's my case
            OR 
            EXISTS (SELECT 1 FROM public.org_members WHERE user_id = auth.uid() AND role = 'owner') -- I'm the boss
        )
    );

-- 3. ENABLE UPDATE ON CASES
-- Lawyers need to update status (Open -> Closed) or details.
DROP POLICY IF EXISTS "Org members can update cases" ON public.cases;
CREATE POLICY "Org members can update cases" ON public.cases
    FOR UPDATE USING (
        _check_org_membership(org_id)
    );

-- 4. ENABLE ATTACHMENTS FOR LAWYERS
-- Currently attachments might only allow client inserts. We need to allow lawyers too.
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lawyers can insert attachments" ON public.attachments;
CREATE POLICY "Lawyers can insert attachments" ON public.attachments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.inquiries 
            WHERE id = inquiry_id 
            AND assigned_lawyer_id = auth.uid() -- I am the lawyer for this inquiry
        )
    );

DROP POLICY IF EXISTS "Lawyers can viewing attachments" ON public.attachments; 
-- (Assuming reading was already handled, but reinforcing just in case)
CREATE POLICY "Lawyers can view attachments" ON public.attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.inquiries 
            WHERE id = inquiry_id 
            AND assigned_lawyer_id = auth.uid()
        )
    );
