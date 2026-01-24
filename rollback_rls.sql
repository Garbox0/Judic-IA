-- ROLLBACK RLS: Ejecutar esto para deshacer los cambios

DROP POLICY IF EXISTS "Public can upload attachments" ON public.attachments;
CREATE POLICY "Public can upload attachments" ON public.attachments
FOR INSERT
TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can insert new inquiries" ON public.inquiries;
CREATE POLICY "Public can insert new inquiries" ON public.inquiries
FOR INSERT
TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can insert messages" ON public.messages;
CREATE POLICY "Public can insert messages" ON public.messages
FOR INSERT
TO public
WITH CHECK (true);

