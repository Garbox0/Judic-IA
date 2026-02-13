-- ═══════════════════════════════════════════════════════
-- JUDIC-IA — Row Level Security Policies
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ═══════════════════════════════════════════════════════

-- ─── PROFILES ───────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Admin can read all profiles
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admin can update all profiles
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Lawyers can see client profiles assigned to them
CREATE POLICY "profiles_select_assigned_clients" ON public.profiles
  FOR SELECT USING (
    assigned_lawyer_id = auth.uid()
  );

-- ─── RESEARCH REPORTS ───────────────────────────────
ALTER TABLE public.research_reports ENABLE ROW LEVEL SECURITY;

-- Users see only their own reports
CREATE POLICY "research_reports_select_own" ON public.research_reports
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own reports
CREATE POLICY "research_reports_insert_own" ON public.research_reports
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ─── CASE LIBRARY (shared, read for all, write for service_role) ──
ALTER TABLE public.case_library ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (it's the shared library)
CREATE POLICY "case_library_select_all" ON public.case_library
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only service_role can insert/update/delete (via API routes)
-- No policy needed — service_role bypasses RLS by default

-- ─── INQUIRIES ──────────────────────────────────────
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- Client sees their own inquiries
CREATE POLICY "inquiries_select_client" ON public.inquiries
  FOR SELECT USING (client_auth_id = auth.uid());

-- Assigned lawyer sees their inquiries
CREATE POLICY "inquiries_select_lawyer" ON public.inquiries
  FOR SELECT USING (assigned_lawyer_id = auth.uid());

-- Admin sees all inquiries
CREATE POLICY "inquiries_select_admin" ON public.inquiries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Client can insert (create new inquiry)
CREATE POLICY "inquiries_insert_client" ON public.inquiries
  FOR INSERT WITH CHECK (client_auth_id = auth.uid());

-- Lawyer can update their assigned inquiries
CREATE POLICY "inquiries_update_lawyer" ON public.inquiries
  FOR UPDATE USING (assigned_lawyer_id = auth.uid());

-- Admin can update all
CREATE POLICY "inquiries_update_admin" ON public.inquiries
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── MESSAGES ───────────────────────────────────────
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Users can see messages for inquiries they own or are assigned to
CREATE POLICY "messages_select_own" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.inquiries i
      WHERE i.id = inquiry_id
      AND (i.client_auth_id = auth.uid() OR i.assigned_lawyer_id = auth.uid())
    )
  );

-- Users can insert messages for their own inquiries
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

-- Users see only their own deadlines
CREATE POLICY "deadlines_select_own" ON public.deadlines
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "deadlines_insert_own" ON public.deadlines
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "deadlines_update_own" ON public.deadlines
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "deadlines_delete_own" ON public.deadlines
  FOR DELETE USING (user_id = auth.uid());

-- ─── INVOICES ───────────────────────────────────────
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Users see only their own invoices
CREATE POLICY "invoices_select_own" ON public.invoices
  FOR SELECT USING (user_id = auth.uid());

-- Admin sees all invoices
CREATE POLICY "invoices_select_admin" ON public.invoices
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admin can update invoices
CREATE POLICY "invoices_update_admin" ON public.invoices
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── ATTACHMENTS ────────────────────────────────────
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Users see attachments for their inquiries
CREATE POLICY "attachments_select_own" ON public.attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.inquiries i
      WHERE i.id = inquiry_id
      AND (i.client_auth_id = auth.uid() OR i.assigned_lawyer_id = auth.uid())
    )
  );

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

-- Only admin can see audit reports
CREATE POLICY "kb_audit_select_admin" ON public.kb_audit_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── DELETION OTPs ──────────────────────────────────
ALTER TABLE public.deletion_otps ENABLE ROW LEVEL SECURITY;

-- Users see only their own OTPs
CREATE POLICY "deletion_otps_select_own" ON public.deletion_otps
  FOR SELECT USING (user_id = auth.uid());

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
-- UPDATE profiles SET role = 'admin' WHERE email = 'gbrlescalada@gmail.com';
