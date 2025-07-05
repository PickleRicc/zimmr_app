-- Add materials column to invoices table
ALTER TABLE public.invoices 
ADD COLUMN materials jsonb NULL;

-- Comment on the column
COMMENT ON COLUMN public.invoices.materials IS 'JSON array containing material details such as name, quantity, unit, and unit_price';
