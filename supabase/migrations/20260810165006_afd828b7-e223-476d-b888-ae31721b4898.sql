DROP POLICY IF EXISTS "Public maintenance QR can upload photos" ON storage.objects;

CREATE POLICY "Public maintenance QR can upload photos"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = 'uploads'
  AND COALESCE((metadata->>'size')::bigint, 0) <= 10485760
  AND COALESCE(metadata->>'mimetype', '') LIKE 'image/%'
);