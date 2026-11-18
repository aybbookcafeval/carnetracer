-- ============================================================
-- Script: Configurar Storage bucket "evidencias" con policies
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Hacer el bucket público (para que las URLs de imágenes funcionen sin auth)
UPDATE storage.buckets 
SET public = true 
WHERE id = 'evidencias';

-- 2. Permitir subir archivos (INSERT) — necesario para uploadImage()
CREATE POLICY "Permitir uploads públicos en evidencias"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'evidencias');

-- 3. Permitir leer/descargar archivos (SELECT) — necesario para ver las imágenes
CREATE POLICY "Permitir lectura pública en evidencias"
ON storage.objects FOR SELECT
USING (bucket_id = 'evidencias');

-- 4. Permitir actualizar archivos (UPDATE) — necesario para upsert
CREATE POLICY "Permitir actualizaciones en evidencias"
ON storage.objects FOR UPDATE
USING (bucket_id = 'evidencias');

-- 5. Permitir eliminar archivos (DELETE) — para limpieza
CREATE POLICY "Permitir eliminación en evidencias"
ON storage.objects FOR DELETE
USING (bucket_id = 'evidencias');

-- ============================================================
-- Verificación: Listar policies creadas
-- ============================================================
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage'
  AND policyname LIKE '%evidencias%';
