-- FIX: Allow clients to view inquiries by email fallback
-- This ensures that if the client is authenticated, they can see their inquiry even if client_auth_id is not yet set.

DROP POLICY IF EXISTS "Clients view their own inquiry" ON public.inquiries;
CREATE POLICY "Clients view their own inquiry" 
ON public.inquiries FOR SELECT 
TO authenticated 
USING (
  client_auth_id = auth.uid() 
  OR 
  contact_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);
