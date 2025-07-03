-- Add additional fields to invoices table
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS service_date DATE,
ADD COLUMN IF NOT EXISTS location VARCHAR(255) DEFAULT '',
ADD COLUMN IF NOT EXISTS vat_exempt BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'invoice' CHECK (type IN ('invoice', 'quote'));
