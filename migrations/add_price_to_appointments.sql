-- Migration: Add price column to appointments table
-- This allows storing the service price when an appointment is completed

ALTER TABLE appointments 
ADD COLUMN price DECIMAL(10,2) DEFAULT NULL;

-- Add comment to document the column purpose
COMMENT ON COLUMN appointments.price IS 'Service price charged for the completed appointment';
