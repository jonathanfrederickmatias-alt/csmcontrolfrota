
-- Create storage bucket for photos
INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true);

-- Storage policies
CREATE POLICY "Anyone can upload photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'photos');

CREATE POLICY "Anyone can view photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'photos');

CREATE POLICY "Authenticated users can delete photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'photos' AND auth.role() = 'authenticated');

-- Add photo column to fuel_records
ALTER TABLE public.fuel_records ADD COLUMN photo_url text;

-- Add photo columns to maintenance_requests
ALTER TABLE public.maintenance_requests ADD COLUMN photo_start_url text;
ALTER TABLE public.maintenance_requests ADD COLUMN photo_end_url text;
