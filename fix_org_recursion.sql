-- FIX FOR RLS INFINITE RECURSION
-- Breaks the loop where org_members checks itself to verify access

-- 1. DROP RECURSIVE POLICIES
DROP POLICY IF EXISTS "Org members can view staff" ON public.org_members;
DROP POLICY IF EXISTS "Org members can view cases" ON public.cases;
DROP POLICY IF EXISTS "Org members can view AI logs" ON public.ai_audit_logs;
DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;

-- 2. SAFE MEMBERSHIP FUNCTION (SECURITY DEFINER)
-- This runs as the owner (bypass RLS) for its internal check
CREATE OR REPLACE FUNCTION public._check_org_membership(_org_id UUID)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = _org_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. RESTORE POLICIES USING SAFE FUNCTION
CREATE POLICY "Org members can view staff" ON public.org_members
    FOR SELECT USING (user_id = auth.uid() OR _check_org_membership(org_id));

CREATE POLICY "Users can view their organizations" ON public.organizations
    FOR SELECT USING (_check_org_membership(id));

CREATE POLICY "Org members can view cases" ON public.cases
    FOR SELECT USING (_check_org_membership(org_id));

CREATE POLICY "Org members can view AI logs" ON public.ai_audit_logs
    FOR SELECT USING (_check_org_membership(org_id));

GRANT EXECUTE ON FUNCTION public._check_org_membership(UUID) TO authenticated;
