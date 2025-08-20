-- Migration: Add German law compliance fields to invoices table
-- Date: 2025-08-20
-- Purpose: WEEK 2 - German law compliance for invoicing module

-- Add German law required fields to invoices table
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS invoice_number_formatted VARCHAR(50), -- German format: 2025-001
ADD COLUMN IF NOT EXISTS tax_number VARCHAR(50), -- Steuernummer
ADD COLUMN IF NOT EXISTS vat_id VARCHAR(50), -- USt-IdNr.
ADD COLUMN IF NOT EXISTS small_business_exempt BOOLEAN DEFAULT FALSE, -- §19 UStG exemption
ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(20) DEFAULT 'final', -- 'final', 'partial', 'down_payment'
ADD COLUMN IF NOT EXISTS legal_footer_text TEXT, -- Required German legal text
ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER DEFAULT 14, -- Zahlungsziel in Tagen
ADD COLUMN IF NOT EXISTS issue_date DATE, -- Rechnungsdatum (separate from created_at)
ADD COLUMN IF NOT EXISTS service_period_start DATE, -- Leistungszeitraum Start
ADD COLUMN IF NOT EXISTS service_period_end DATE, -- Leistungszeitraum Ende
ADD COLUMN IF NOT EXISTS reverse_charge BOOLEAN DEFAULT FALSE, -- Reverse Charge Verfahren
ADD COLUMN IF NOT EXISTS dunning_level INTEGER DEFAULT 0, -- Mahnstufe (0 = keine Mahnung)
ADD COLUMN IF NOT EXISTS last_dunning_date DATE, -- Datum der letzten Mahnung
ADD COLUMN IF NOT EXISTS dunning_fees DECIMAL(10,2) DEFAULT 0.00; -- Mahngebühren

-- Create index for efficient invoice number lookups
CREATE INDEX IF NOT EXISTS idx_invoices_number_formatted ON invoices(invoice_number_formatted);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_dunning_level ON invoices(dunning_level);

-- Add craftsman table fields for German business info (if not exists)
ALTER TABLE craftsmen 
ADD COLUMN IF NOT EXISTS tax_number VARCHAR(50), -- Steuernummer
ADD COLUMN IF NOT EXISTS vat_id VARCHAR(50), -- USt-IdNr.
ADD COLUMN IF NOT EXISTS small_business_exempt BOOLEAN DEFAULT FALSE, -- §19 UStG
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100), -- Bankname
ADD COLUMN IF NOT EXISTS iban VARCHAR(34), -- IBAN
ADD COLUMN IF NOT EXISTS bic VARCHAR(11), -- BIC/SWIFT
ADD COLUMN IF NOT EXISTS business_registration VARCHAR(50), -- Handelsregisternummer
ADD COLUMN IF NOT EXISTS chamber_registration VARCHAR(50); -- Handwerkskammernummer

-- Create function to generate German-format invoice numbers
CREATE OR REPLACE FUNCTION generate_german_invoice_number(craftsman_id_param UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    current_year INTEGER;
    next_number INTEGER;
    formatted_number VARCHAR(50);
BEGIN
    -- Get current year
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- Get the next sequential number for this craftsman and year
    SELECT COALESCE(MAX(
        CASE 
            WHEN invoice_number_formatted ~ ('^' || current_year || '-[0-9]+$')
            THEN CAST(SPLIT_PART(invoice_number_formatted, '-', 2) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO next_number
    FROM invoices 
    WHERE craftsman_id = craftsman_id_param;
    
    -- Format as YYYY-NNN (e.g., 2025-001)
    formatted_number := current_year || '-' || LPAD(next_number::TEXT, 3, '0');
    
    RETURN formatted_number;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate invoice numbers
CREATE OR REPLACE FUNCTION set_invoice_number_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set invoice number if not already provided
    IF NEW.invoice_number_formatted IS NULL OR NEW.invoice_number_formatted = '' THEN
        NEW.invoice_number_formatted := generate_german_invoice_number(NEW.craftsman_id);
    END IF;
    
    -- Set issue_date if not provided
    IF NEW.issue_date IS NULL THEN
        NEW.issue_date := CURRENT_DATE;
    END IF;
    
    -- Set default payment terms if not provided
    IF NEW.payment_terms_days IS NULL THEN
        NEW.payment_terms_days := 14;
    END IF;
    
    -- Calculate due_date based on issue_date and payment_terms_days
    IF NEW.due_date IS NULL AND NEW.issue_date IS NOT NULL AND NEW.payment_terms_days IS NOT NULL THEN
        NEW.due_date := NEW.issue_date + INTERVAL '1 day' * NEW.payment_terms_days;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_set_invoice_number ON invoices;
CREATE TRIGGER trigger_set_invoice_number
    BEFORE INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION set_invoice_number_trigger();

-- Add comments for documentation
COMMENT ON COLUMN invoices.invoice_number_formatted IS 'German format invoice number (YYYY-NNN)';
COMMENT ON COLUMN invoices.tax_number IS 'German tax number (Steuernummer)';
COMMENT ON COLUMN invoices.vat_id IS 'German VAT ID (USt-IdNr.)';
COMMENT ON COLUMN invoices.small_business_exempt IS 'Small business VAT exemption per §19 UStG';
COMMENT ON COLUMN invoices.invoice_type IS 'Type: final, partial, down_payment';
COMMENT ON COLUMN invoices.legal_footer_text IS 'Required German legal text for invoices';
COMMENT ON COLUMN invoices.dunning_level IS 'Dunning level (0=none, 1=first reminder, 2=second, 3=final)';
