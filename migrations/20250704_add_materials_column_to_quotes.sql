-- Add materials JSON column to quotes table
ALTER TABLE public.quotes
ADD COLUMN materials JSONB DEFAULT NULL;

-- Add comment to explain the materials field
COMMENT ON COLUMN public.quotes.materials IS 'JSON array of material objects for quick access (duplicates quote_materials table for convenience)';
