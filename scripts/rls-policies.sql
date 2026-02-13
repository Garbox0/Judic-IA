-- ═══════════════════════════════════════════════════════
-- JUDIC-IA — Row Level Security Policies
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- Safe to re-run: drops existing policies before creating
-- ═══════════════════════════════════════════════════════

-- ─── PROFILES ───────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "profiles_select_assigned_clients" ON public.profiles;
CREATE POLICY "profiles_select_assigned_clients" ON public.profiles
  FOR SELECT USING (
    assigned_lawyer_id = auth.uid()
  );

-- ─── RESEARCH REPORTS ───────────────────────────────
ALTER TABLE public.research_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "research_reports_select_own" ON public.research_reports;
CREATE POLICY "research_reports_select_own" ON public.research_reports
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "research_reports_insert_own" ON public.research_reports;
CREATE POLICY "research_reports_insert_own" ON public.research_reports
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ─── CASE LIBRARY (shared, read for all, write for service_role) ──
ALTER TABLE public.case_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "case_library_select_all" ON public.case_library;
CREATE POLICY "case_library_select_all" ON public.case_library
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only service_role can insert/update/delete (via API routes)
-- No policy needed — service_role bypasses RLS by default

-- ─── INQUIRIES ──────────────────────────────────────
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inquiries_select_client" ON public.inquiries;
CREATE POLICY "inquiries_select_client" ON public.inquiries
  FOR SELECT USING (client_auth_id = auth.uid());

DROP POLICY IF EXISTS "inquiries_select_lawyer" ON public.inquiries;
CREATE POLICY "inquiries_select_lawyer" ON public.inquiries
  FOR SELECT USING (assigned_lawyer_id = auth.uid());

DROP POLICY IF EXISTS "inquiries_select_admin" ON public.inquiries;
CREATE POLICY "inquiries_select_admin" ON public.inquiries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "inquiries_insert_client" ON public.inquiries;
CREATE POLICY "inquiries_insert_client" ON public.inquiries
  FOR INSERT WITH CHECK (client_auth_id = auth.uid());

DROP POLICY IF EXISTS "inquiries_update_lawyer" ON public.inquiries;
CREATE POLICY "inquiries_update_lawyer" ON public.inquiries
  FOR UPDATE USING (assigned_lawyer_id = auth.uid());

DROP POLICY IF EXISTS "inquiries_update_admin" ON public.inquiries;
CREATE POLICY "inquiries_update_admin" ON public.inquiries
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── MESSAGES ───────────────────────────────────────
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_own" ON public.messages;
CREATE POLICY "messages_select_own" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.inquiries i
      WHERE i.id = inquiry_id
      AND (i.client_auth_id = auth.uid() OR i.assigned_lawyer_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
CREATE POLICY "messages_insert_own" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inquiries i
      WHERE i.id = inquiry_id
      AND (i.client_auth_id = auth.uid() OR i.assigned_lawyer_id = auth.uid())
    )
  );

-- ─── DEADLINES ──────────────────────────────────────
ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deadlines_select_own" ON public.deadlines;
CREATE POLICY "deadlines_select_own" ON public.deadlines
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "deadlines_insert_own" ON public.deadlines;
CREATE POLICY "deadlines_insert_own" ON public.deadlines
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "deadlines_update_own" ON public.deadlines;
CREATE POLICY "deadlines_update_own" ON public.deadlines
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "deadlines_delete_own" ON public.deadlines;
CREATE POLICY "deadlines_delete_own" ON public.deadlines
  FOR DELETE USING (user_id = auth.uid());

-- ─── INVOICES ───────────────────────────────────────
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_select_own" ON public.invoices;
CREATE POLICY "invoices_select_own" ON public.invoices
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "invoices_select_admin" ON public.invoices;
CREATE POLICY "invoices_select_admin" ON public.invoices
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "invoices_update_admin" ON public.invoices;
CREATE POLICY "invoices_update_admin" ON public.invoices
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── ATTACHMENTS ────────────────────────────────────
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attachments_select_own" ON public.attachments;
CREATE POLICY "attachments_select_own" ON public.attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.inquiries i
      WHERE i.id = inquiry_id
      AND (i.client_auth_id = auth.uid() OR i.assigned_lawyer_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "attachments_insert_own" ON public.attachments;
CREATE POLICY "attachments_insert_own" ON public.attachments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inquiries i
      WHERE i.id = inquiry_id
      AND (i.client_auth_id = auth.uid() OR i.assigned_lawyer_id = auth.uid())
    )
  );

-- ─── KB AUDIT REPORTS ───────────────────────────────
ALTER TABLE public.kb_audit_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kb_audit_select_admin" ON public.kb_audit_reports;
CREATE POLICY "kb_audit_select_admin" ON public.kb_audit_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── DELETION OTPs ──────────────────────────────────
ALTER TABLE public.deletion_otps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deletion_otps_select_own" ON public.deletion_otps;
CREATE POLICY "deletion_otps_select_own" ON public.deletion_otps
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "deletion_otps_insert_own" ON public.deletion_otps;
CREATE POLICY "deletion_otps_insert_own" ON public.deletion_otps
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ─── DEMO LIMITS ────────────────────────────────────
ALTER TABLE public.demo_limits ENABLE ROW LEVEL SECURITY;
-- No user policy — only service_role can read/write demo_limits

-- ─── ADMIN OTPs ─────────────────────────────────────
ALTER TABLE public.admin_otps ENABLE ROW LEVEL SECURITY;
-- No user policy — only service_role can read/write admin OTPs

-- ─── PASSWORD HISTORY ───────────────────────────────
ALTER TABLE public.password_history ENABLE ROW LEVEL SECURITY;
-- No user policy — only service_role manages password history

-- ═══════════════════════════════════════════════════════
-- IMPORTANT: Verify your admin profile has role = 'admin'
-- ═══════════════════════════════════════════════════════
UPDATE profiles SET role = 'admin' WHERE email = 'gbrlescalada@gmail.com';
