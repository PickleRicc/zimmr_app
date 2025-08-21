-- Fix the time tracking trigger function to ensure duration is calculated properly
-- Migration: 20250821_fix_time_tracking_trigger

-- Drop existing trigger
DROP TRIGGER IF EXISTS trigger_calculate_duration ON time_tracking;

-- Recreate the function with proper duration calculation
CREATE OR REPLACE FUNCTION calculate_time_tracking_duration()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate duration in minutes when session is completed
    IF NEW.status = 'completed' AND NEW.end_time IS NOT NULL THEN
        -- Ensure duration is at least 1 minute for completed sessions
        NEW.duration_minutes = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60));
    END IF;
    
    -- Update the updated_at timestamp
    NEW.updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger for both INSERT and UPDATE
CREATE TRIGGER trigger_calculate_duration
    BEFORE INSERT OR UPDATE ON time_tracking
    FOR EACH ROW
    EXECUTE FUNCTION calculate_time_tracking_duration();
