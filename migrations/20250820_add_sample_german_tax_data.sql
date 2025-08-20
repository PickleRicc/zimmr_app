-- Migration: Add sample German tax data for testing
-- Date: 2025-08-20
-- Purpose: Populate craftsman profiles with German tax information for PDF testing

-- Update existing craftsmen with sample German tax data
UPDATE craftsmen 
SET 
  tax_number = CASE 
    WHEN tax_number IS NULL OR tax_number = '' THEN '123/456/78901'
    ELSE tax_number
  END,
  vat_id = CASE 
    WHEN vat_id IS NULL OR vat_id = '' THEN 'DE123456789'
    ELSE vat_id
  END,
  small_business_exempt = COALESCE(small_business_exempt, false),
  bank_name = CASE 
    WHEN bank_name IS NULL OR bank_name = '' THEN 'Deutsche Bank'
    ELSE bank_name
  END,
  iban = CASE 
    WHEN iban IS NULL OR iban = '' THEN 'DE89 3704 0044 0532 0130 00'
    ELSE iban
  END,
  bic = CASE 
    WHEN bic IS NULL OR bic = '' THEN 'COBADEFFXXX'
    ELSE bic
  END,
  business_registration = CASE 
    WHEN business_registration IS NULL OR business_registration = '' THEN 'HRB 12345'
    ELSE business_registration
  END,
  chamber_registration = CASE 
    WHEN chamber_registration IS NULL OR chamber_registration = '' THEN 'HWK 67890'
    ELSE chamber_registration
  END
WHERE id IS NOT NULL;

-- Add comment
COMMENT ON TABLE craftsmen IS 'Updated with sample German tax and banking data for compliance testing';
