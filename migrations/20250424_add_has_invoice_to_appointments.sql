-- Add has_invoice column to appointments table
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS has_invoice BOOLEAN DEFAULT false;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_appointments_has_invoice ON appointments(has_invoice);

-- Update existing appointments that have invoices
UPDATE appointments a
SET has_invoice = true
FROM invoices i
WHERE a.id = i.appointment_id;
