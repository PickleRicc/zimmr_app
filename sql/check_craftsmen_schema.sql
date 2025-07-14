-- Check the current schema of the craftsmen table
-- Run this in your Supabase SQL editor to see what columns exist

-- 1. Check table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'craftsmen' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check if there are any duplicate user_id records
SELECT 
    user_id,
    COUNT(*) as record_count,
    STRING_AGG(id::text, ', ') as craftsman_ids
FROM craftsmen 
GROUP BY user_id 
HAVING COUNT(*) > 1;

-- 3. Check total records
SELECT COUNT(*) as total_craftsmen FROM craftsmen;

-- 4. Sample data (first 5 records)
SELECT * FROM craftsmen LIMIT 5;
