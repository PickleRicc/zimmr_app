-- Time Tracking Module Database Schema
-- Implements WEEK 2 requirements from AI guide

-- Create an IMMUTABLE function for date extraction
CREATE OR REPLACE FUNCTION get_tracking_date(ts TIMESTAMP WITH TIME ZONE) 
RETURNS DATE 
IMMUTABLE 
LANGUAGE SQL AS $$
    SELECT DATE(ts);
$$;

-- Create time_tracking table for tracking work sessions
CREATE TABLE IF NOT EXISTS time_tracking (
    id SERIAL PRIMARY KEY,
    craftsman_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Project/Job Information
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    project_name VARCHAR(255),
    location TEXT,
    
    -- Time Tracking Data
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER, -- Calculated field for completed sessions
    
    -- Session Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    
    -- Manual Entry Support
    is_manual_entry BOOLEAN DEFAULT FALSE,
    
    -- Work Description
    description TEXT,
    notes TEXT,
    
    -- Billing Information
    is_billable BOOLEAN DEFAULT FALSE,
    hourly_rate DECIMAL(10,2),
    
    -- Auto-selection metadata
    auto_selected_by VARCHAR(50), -- 'location', 'time', 'manual'
    
    -- German compliance - 2 year retention minimum
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    CONSTRAINT valid_duration CHECK (
        (status = 'completed' AND end_time IS NOT NULL AND duration_minutes IS NOT NULL) OR
        (status != 'completed')
    )
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_time_tracking_craftsman_id ON time_tracking(craftsman_id);
CREATE INDEX IF NOT EXISTS idx_time_tracking_appointment_id ON time_tracking(appointment_id);
CREATE INDEX IF NOT EXISTS idx_time_tracking_customer_id ON time_tracking(customer_id);
CREATE INDEX IF NOT EXISTS idx_time_tracking_start_time ON time_tracking(start_time);
CREATE INDEX IF NOT EXISTS idx_time_tracking_status ON time_tracking(status);

-- Create an IMMUTABLE index for date using the custom function
CREATE INDEX IF NOT EXISTS idx_time_tracking_date 
ON time_tracking USING btree (get_tracking_date(start_time));

-- Create function to automatically update duration when session ends
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

-- Create trigger to automatically calculate duration
DROP TRIGGER IF EXISTS trigger_calculate_duration ON time_tracking;
CREATE TRIGGER trigger_calculate_duration
    BEFORE UPDATE ON time_tracking
    FOR EACH ROW
    EXECUTE FUNCTION calculate_time_tracking_duration();

-- Create time_tracking_breaks table for pause/resume functionality
CREATE TABLE IF NOT EXISTS time_tracking_breaks (
    id SERIAL PRIMARY KEY,
    time_tracking_id INTEGER NOT NULL REFERENCES time_tracking(id) ON DELETE CASCADE,
    
    break_start TIMESTAMP WITH TIME ZONE NOT NULL,
    break_end TIMESTAMP WITH TIME ZONE,
    break_duration_minutes INTEGER,
    
    reason VARCHAR(100), -- 'pause', 'lunch', 'travel', etc.
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for breaks
CREATE INDEX IF NOT EXISTS idx_time_tracking_breaks_tracking_id ON time_tracking_breaks(time_tracking_id);

-- Create function to calculate total break time
CREATE OR REPLACE FUNCTION calculate_break_duration()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate break duration in minutes when break ends
    IF NEW.break_end IS NOT NULL THEN
        NEW.break_duration_minutes = EXTRACT(EPOCH FROM (NEW.break_end - NEW.break_start)) / 60;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for break duration calculation
DROP TRIGGER IF EXISTS trigger_calculate_break_duration ON time_tracking_breaks;
CREATE TRIGGER trigger_calculate_break_duration
    BEFORE UPDATE ON time_tracking_breaks
    FOR EACH ROW
    EXECUTE FUNCTION calculate_break_duration();

-- Create view for daily time summaries
CREATE OR REPLACE VIEW daily_time_summary AS
SELECT 
    craftsman_id,
    get_tracking_date(start_time) as work_date,
    COUNT(*) as total_sessions,
    SUM(duration_minutes) as total_minutes,
    ROUND(SUM(duration_minutes) / 60.0, 2) as total_hours,
    MIN(start_time) as first_start,
    MAX(COALESCE(end_time, start_time)) as last_activity,
    COUNT(CASE WHEN appointment_id IS NOT NULL THEN 1 END) as appointment_sessions,
    COUNT(CASE WHEN is_manual_entry = true THEN 1 END) as manual_entries
FROM time_tracking 
WHERE status = 'completed'
GROUP BY craftsman_id, get_tracking_date(start_time);

-- Create view for project time summaries (for invoice integration)
CREATE OR REPLACE VIEW project_time_summary AS
SELECT 
    craftsman_id,
    appointment_id,
    customer_id,
    project_name,
    location,
    COUNT(*) as total_sessions,
    SUM(duration_minutes) as total_minutes,
    ROUND(SUM(duration_minutes) / 60.0, 2) as total_hours,
    MIN(start_time) as project_start,
    MAX(end_time) as project_end,
    STRING_AGG(DISTINCT description, '; ') as combined_description
FROM time_tracking 
WHERE status = 'completed'
GROUP BY craftsman_id, appointment_id, customer_id, project_name, location;

-- Add RLS (Row Level Security) policies
ALTER TABLE time_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_tracking_breaks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own time tracking data
CREATE POLICY "Users can view own time tracking" ON time_tracking
    FOR ALL USING (auth.uid() = craftsman_id);

CREATE POLICY "Users can view own time tracking breaks" ON time_tracking_breaks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM time_tracking 
            WHERE time_tracking.id = time_tracking_breaks.time_tracking_id 
            AND time_tracking.craftsman_id = auth.uid()
        )
    );

-- Grant necessary permissions
GRANT ALL ON time_tracking TO authenticated;
GRANT ALL ON time_tracking_breaks TO authenticated;
GRANT USAGE ON SEQUENCE time_tracking_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE time_tracking_breaks_id_seq TO authenticated;
GRANT SELECT ON daily_time_summary TO authenticated;
GRANT SELECT ON project_time_summary TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE time_tracking IS 'Time tracking sessions for craftsmen - supports start/stop/pause functionality with 2-year retention for German compliance';
COMMENT ON TABLE time_tracking_breaks IS 'Break periods within time tracking sessions for accurate time calculation';
COMMENT ON VIEW daily_time_summary IS 'Daily time summaries for reporting and daily log views';
COMMENT ON VIEW project_time_summary IS 'Project-based time summaries for invoice and quote integration';