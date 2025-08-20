-- Add uploaded_files field to quotes table for storing image uploads
-- Migration: 20250820_add_uploaded_files_to_quotes.sql

ALTER TABLE public.quotes 
ADD COLUMN uploaded_files JSONB NULL DEFAULT '[]'::jsonb;

-- Add comment to document the field structure
COMMENT ON COLUMN public.quotes.uploaded_files IS 'Array of uploaded files with structure: [{"name": "filename.jpg", "type": "image/jpeg", "size": 1234567, "data": "base64string"}]';

-- Create index for better query performance on uploaded_files
CREATE INDEX IF NOT EXISTS idx_quotes_uploaded_files ON public.quotes USING GIN (uploaded_files);
