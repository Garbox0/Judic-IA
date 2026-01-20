-- 🛡️ JUDIC-IA: STORAGE HARDENING (inquiry-attachments)
-- Este script blinda el bucket de archivos para prevenir ataques de carga de malware o exceso de storage.

-- 1. Asegurar que el bucket exista y sea público (para lectura de archivos adjuntos)
-- Nota: La lectura es pública, pero la subida es restringida.
INSERT INTO storage.buckets (id, name, public)
VALUES ('inquiry-attachments', 'inquiry-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Limpiar políticas previas para evitar conflictos
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow Public Upload" ON storage.objects;
DROP POLICY IF EXISTS "Restricted Upload with Validation" ON storage.objects;

-- 3. Política de LECTURA: Pública
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'inquiry-attachments');

-- 4. Política de SUBIDA (INSERT): Validada en el Servidor
-- Restricciones: 
-- - Solo en el bucket 'inquiry-attachments'
-- - Solo archivos < 5MB (5242880 bytes)
-- - Solo MIME types legales (PDF, JPG, PNG)
CREATE POLICY "Restricted Upload with Validation"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'inquiry-attachments' AND
  (storage.extension(name) = 'pdf' OR storage.extension(name) = 'jpg' OR storage.extension(name) = 'jpeg' OR storage.extension(name) = 'png') AND
  (CASE 
    WHEN (metadata->>'size')::int <= 5242880 THEN true 
    ELSE false 
  END) AND
  (mimetype = 'application/pdf' OR mimetype = 'image/jpeg' OR mimetype = 'image/png')
);

-- 5. Hardening adicional: Prevenir borrado por parte de terceros
DROP POLICY IF EXISTS "No Delete for Clients" ON storage.objects;
CREATE POLICY "No Delete for Clients"
ON storage.objects FOR DELETE
TO public
USING (false); -- Nadie borra archivos vía API pública
