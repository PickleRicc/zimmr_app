-- Simplify time tracking by removing trigger dependency
-- Migration: 20250821_simplify_time_tracking_trigger

-- Drop the problematic trigger entirely
DROP TRIGGER IF EXISTS trigger_calculate_duration ON time_tracking;

-- Drop the trigger function since we're handling duration in frontend
DROP FUNCTION IF EXISTS calculate_time_tracking_duration();

-- Create a simple trigger just for updated_at timestamp
CREATE OR REPLACE FUNCTION update_time_tracking_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create simple trigger for timestamp updates only
CREATE TRIGGER trigger_update_timestamp
    BEFORE UPDATE ON time_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_time_tracking_timestamp();
