-- Add issued_date column to invoices table
-- This migration adds the missing issued_date column referenced by the finance stats API

-- Add the column if it doesn't exist
ALTER TABLE IF EXISTS invoices
ADD COLUMN IF NOT EXISTS issued_date DATE;

-- Update existing records to use created_at date as issued_date
-- This ensures backward compatibility with existing data
UPDATE invoices
SET issued_date = created_at::DATE
WHERE issued_date IS NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_issued_date ON invoices(issued_date);

-- Add comment explaining column purpose
COMMENT ON COLUMN invoices.issued_date IS 'The date when Invoice was issued to the customer. Used for finance reporting.';
