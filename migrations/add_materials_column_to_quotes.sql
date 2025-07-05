-- Add materials column to quotes table
ALTER TABLE public.quotes 
ADD COLUMN materials jsonb NULL;

-- Comment on the column
COMMENT ON COLUMN public.quotes.materials IS 'JSON array containing material details such as name, quantity, unit, and unit_price';
