-- Enable pg_trgm for fuzzy search if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Create the PRIVATE link table (Multi-Tenant Isolation)
CREATE TABLE IF NOT EXISTS public.organization_library (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    case_url TEXT NOT NULL REFERENCES public.case_library(url) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    tags TEXT[] DEFAULT '{}',
    -- Prevent duplicate entries for the same case in the same org
    UNIQUE(org_id, case_url)
);

-- 2. Enable RLS
ALTER TABLE public.organization_library ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies using the existing _check_org_membership function

-- VIEW: Convert membership check to boolean or simple exists
CREATE POLICY "Users can view library of their org" 
ON public.organization_library FOR SELECT 
USING (
    public._check_org_membership(org_id)
);

-- INSERT: Only members can add to library
CREATE POLICY "Users can add to library of their org" 
ON public.organization_library FOR INSERT 
WITH CHECK (
    public._check_org_membership(org_id)
);

-- UPDATE: Only members can tag/edit
CREATE POLICY "Users can update library of their org" 
ON public.organization_library FOR UPDATE
USING (
    public._check_org_membership(org_id)
);

-- DELETE: Only members can remove from library
CREATE POLICY "Users can remove from library of their org" 
ON public.organization_library FOR DELETE
USING (
    public._check_org_membership(org_id)
);

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_lib_org_id ON public.organization_library(org_id);
CREATE INDEX IF NOT EXISTS idx_org_lib_case_url ON public.organization_library(case_url);

-- 5. Helper View for easier querying (Optional but recommended)
-- This joins the private link with the public data for a complete view
CREATE OR REPLACE VIEW public.v_organization_library AS
SELECT 
    ol.id as entry_id,
    ol.org_id,
    ol.created_at as saved_at,
    ol.tags,
    cl.*
FROM 
    public.organization_library ol
JOIN 
    public.case_library cl ON ol.case_url = cl.url;

-- Grant access to the view (RLS is enforced on the underlying table 'organization_library')
GRANT SELECT ON public.v_organization_library TO authenticated;
