CREATE POLICY "Authenticated users read reports" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'reports');
CREATE POLICY "Service role writes reports" ON storage.objects
  FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'reports');
CREATE POLICY "Service role updates reports" ON storage.objects
  FOR UPDATE TO service_role
  USING (bucket_id = 'reports');