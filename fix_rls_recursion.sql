-- SAFE RLS OVERRIDE (Fixing Infinite Recursion)
-- Objective: Remove recursive subqueries and use direct column/JWT checks.

-- 🔧 1. Reset Profiles Policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Lawyers can see their assigned clients" ON public.profiles;
DROP POLICY IF EXISTS "Lawyers can view their clients" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are visible to relevant parties" ON public.profiles;

CREATE POLICY "Safe profile visibility" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (
    id = auth.uid() -- Can see self
    OR 
    role = 'lawyer' -- Lawyers are professional/public profiles for all clients
    OR 
    assigned_lawyer_id = auth.uid() -- Lawyer can see their own clients
);

-- 🔧 2. Reset Inquiries Policies
DROP POLICY IF EXISTS "Lawyers manage their inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Clients view their own inquiry" ON public.inquiries;

CREATE POLICY "Lawyers manage inquiries" 
ON public.inquiries FOR ALL 
TO authenticated 
USING (assigned_lawyer_id = auth.uid());

CREATE POLICY "Clients view inquiries" 
ON public.inquiries FOR SELECT 
TO authenticated 
USING (
    client_auth_id = auth.uid() 
    OR 
    contact_email = (auth.jwt() ->> 'email') -- Safe email check from JWT, no recursion
);

-- 🔧 3. Fix the get_my_role function to be safe (Security Definer)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  -- Security Definer ensures this runs with table owner permissions, bypassing RLS
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 🛡️ Double Check: Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- 🧹 Audit Log (Optional but safe)
DO $$ BEGIN
    RAISE NOTICE 'RLS Hardening Complete: Recursion Fixed.';
END $$;
