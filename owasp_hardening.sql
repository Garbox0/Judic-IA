-- OWASP TOP 10 HARDENING SCRIPT
-- Objective: Shield the app against common vulnerabilities (OWASP A01, A03, A07)

-- 1. [A01: Broken Access Control] Hardening RLS
-- We ensure that access is strictly bound to the authenticated user's role and ID.

-- Secure profile access
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Lawyers can see their assigned clients" ON public.profiles;
CREATE POLICY "Lawyers can see their assigned clients" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'lawyer' 
  AND assigned_lawyer_id = auth.uid()
);

-- Secure inquiries access
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lawyers manage their inquiries" ON public.inquiries;
CREATE POLICY "Lawyers manage their inquiries" 
ON public.inquiries FOR ALL 
TO authenticated 
USING (assigned_lawyer_id = auth.uid());

DROP POLICY IF EXISTS "Clients view their own inquiry" ON public.inquiries;
CREATE POLICY "Clients view their own inquiry" 
ON public.inquiries FOR SELECT 
TO authenticated 
USING (client_auth_id = auth.uid());

-- 2. [A03: Injection] Strict Data Validation
-- Use check constraints to prevent malicious or malformed data entry.

ALTER TABLE public.inquiries 
ADD CONSTRAINT check_contact_email 
CHECK (contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- 3. [A07: Identification and Authentication Failures] 
-- Secure Audit Triggers for critical changes

CREATE OR REPLACE FUNCTION public.log_critical_changes()
RETURNS TRIGGER AS $$
BEGIN
  RAISE NOTICE 'Critical data change by user: %, Table: %, ID: %', auth.uid(), TG_TABLE_NAME, OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_inquiry_deletion
BEFORE DELETE ON public.inquiries
FOR EACH ROW EXECUTE FUNCTION public.log_critical_changes();

-- 4. Secure function for role checking
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;
