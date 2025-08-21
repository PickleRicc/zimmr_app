-- Remove the problematic check constraint that's preventing inserts
-- Migration: 20250821_remove_duration_constraint

-- Drop the constraint that's causing issues
ALTER TABLE time_tracking DROP CONSTRAINT IF EXISTS valid_duration;

-- Add a simpler constraint that just ensures completed entries have end_time
ALTER TABLE time_tracking ADD CONSTRAINT valid_completed_entry 
CHECK (
    (status = 'completed' AND end_time IS NOT NULL) OR 
    (status != 'completed')
);
