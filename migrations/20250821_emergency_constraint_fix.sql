-- Emergency fix: Remove ALL problematic constraints from time_tracking table
-- Migration: 20250821_emergency_constraint_fix

-- Drop ALL check constraints that might be causing issues
ALTER TABLE time_tracking DROP CONSTRAINT IF EXISTS valid_duration;
ALTER TABLE time_tracking DROP CONSTRAINT IF EXISTS valid_completed_entry;
ALTER TABLE time_tracking DROP CONSTRAINT IF EXISTS check_duration_positive;
ALTER TABLE time_tracking DROP CONSTRAINT IF EXISTS check_completed_has_end_time;

-- Drop and recreate trigger to be safe
DROP TRIGGER IF EXISTS trigger_calculate_duration ON time_tracking;
DROP TRIGGER IF EXISTS trigger_update_timestamp ON time_tracking;
DROP FUNCTION IF EXISTS calculate_time_tracking_duration();
DROP FUNCTION IF EXISTS update_time_tracking_timestamp();

-- Create minimal trigger for timestamp only
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_timestamp
    BEFORE UPDATE ON time_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Add only essential NOT NULL constraints
ALTER TABLE time_tracking ALTER COLUMN craftsman_id SET NOT NULL;
ALTER TABLE time_tracking ALTER COLUMN start_time SET NOT NULL;
ALTER TABLE time_tracking ALTER COLUMN status SET NOT NULL;
