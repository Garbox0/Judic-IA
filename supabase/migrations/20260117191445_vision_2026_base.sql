-- ==========================================
-- JUDIC-IA VISION 2026: BASE SCHEMA
-- ==========================================

-- 1. Organizations (Estudios Legales)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id),
    plan_tier TEXT DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT now(),
    settings JSONB DEFAULT '{}'::jsonb
);

-- 2. Organization Members (Abogados y Staff)
CREATE TABLE IF NOT EXISTS public.org_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('owner', 'lawyer', 'staff', 'admin')) DEFAULT 'lawyer',
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, user_id)
);

-- 3. Cases (Expedientes Internos)
-- Evolución de un inquiry (lead) a un caso oficial del estudio
CREATE TABLE IF NOT EXISTS public.cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    matter TEXT, -- Materia: Familia, Penal, etc.
    status TEXT DEFAULT 'open', -- open, in_progress, closed, archived
    inquiry_id UUID REFERENCES public.inquiries(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. AI Audit Logs (Gobernanza de IA)
CREATE TABLE IF NOT EXISTS public.ai_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    mode TEXT NOT NULL, -- intake, research, sales, internal
    purpose TEXT,
    input_redacted TEXT, -- Almacenamos el input sanitizado
    output TEXT,
    model TEXT,
    tokens_used INTEGER,
    risk_score INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Add organization support to profiles and inquiries
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='org_id') THEN
        ALTER TABLE public.profiles ADD COLUMN org_id UUID REFERENCES public.organizations(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inquiries' AND column_name='org_id') THEN
        ALTER TABLE public.inquiries ADD COLUMN org_id UUID REFERENCES public.organizations(id);
    END IF;
END $$;

-- 6. Basic RLS for new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

-- 6.1 Policies: Studio members can see their studio
CREATE POLICY "Users can view their organizations" ON public.organizations
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.org_members WHERE org_id = organizations.id AND user_id = auth.uid())
    );

CREATE POLICY "Org members can view staff" ON public.org_members
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Org members can view cases" ON public.cases
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Org members can view AI logs" ON public.ai_audit_logs
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid())
    );

COMMENT ON TABLE public.organizations IS 'Legal studios / entities in the platform.';
COMMENT ON TABLE public.cases IS 'Internal case management derived from user inquiries.';
COMMENT ON TABLE public.ai_audit_logs IS 'Audit trail for and AI governance.';
