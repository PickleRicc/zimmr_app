-- Fix finances table to use UUID craftsman_id instead of INTEGER
-- This aligns with the current system that uses UUID craftsman IDs

-- First, check current finances table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'finances' 
ORDER BY ordinal_position;

-- Check if there are any existing records (backup if needed)
SELECT COUNT(*) as existing_records FROM finances;

-- If there are existing records, show them for backup
SELECT * FROM finances;

-- Drop the existing table and recreate with correct schema
DROP TABLE IF EXISTS finances CASCADE;

-- Create finances table with UUID craftsman_id
CREATE TABLE finances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  craftsman_id UUID NOT NULL REFERENCES craftsmen(id) ON DELETE CASCADE,
  goal_amount NUMERIC(12,2) NOT NULL,
  goal_period VARCHAR(16) NOT NULL, -- 'month', 'year', 'all'
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (craftsman_id, goal_period)
);

-- Index for quick lookup by craftsman
CREATE INDEX idx_finances_craftsman_id ON finances(craftsman_id);

-- Add RLS policy for finances table
ALTER TABLE finances ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own finance records
CREATE POLICY "Users can manage their own finance records" ON finances
  FOR ALL USING (
    craftsman_id IN (
      SELECT id FROM craftsmen WHERE user_id = auth.uid()
    )
  );

-- Verify the new table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'finances' 
ORDER BY ordinal_position;

-- Test that the table is working by checking if we can query it
SELECT COUNT(*) as record_count FROM finances;
