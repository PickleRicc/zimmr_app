-- Fix foreign key references in time_tracking table
-- Migration: 20250821_fix_foreign_key_references

-- Drop the incorrect foreign key constraint
ALTER TABLE time_tracking DROP CONSTRAINT IF EXISTS time_tracking_craftsman_id_fkey;

-- Add correct foreign key constraint to craftsmen table
ALTER TABLE time_tracking ADD CONSTRAINT time_tracking_craftsman_id_fkey 
    FOREIGN KEY (craftsman_id) REFERENCES craftsmen(id) ON DELETE CASCADE;
