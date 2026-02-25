
-- Add type column to checklists (corrective/preventive/daily)
ALTER TABLE public.checklists 
ADD COLUMN type text NOT NULL DEFAULT 'daily';

-- Add photo_url column to checklists for NC evidence
ALTER TABLE public.checklists 
ADD COLUMN photo_url text;
