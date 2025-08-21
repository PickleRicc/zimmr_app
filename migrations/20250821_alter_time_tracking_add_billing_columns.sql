-- Add missing billing columns to existing time_tracking table
-- Migration: 20250821_alter_time_tracking_add_billing_columns

-- Add is_billable column
ALTER TABLE time_tracking 
ADD COLUMN IF NOT EXISTS is_billable BOOLEAN DEFAULT FALSE;

-- Add hourly_rate column
ALTER TABLE time_tracking 
ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2);

-- Add comment for documentation
COMMENT ON COLUMN time_tracking.is_billable IS 'Whether this time entry should be billed to the customer';
COMMENT ON COLUMN time_tracking.hourly_rate IS 'Hourly rate for this specific time entry (overrides default rate)';
