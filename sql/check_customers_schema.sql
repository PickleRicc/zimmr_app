-- Check the current schema of the customers table
-- Run this in your Supabase SQL editor to see what columns exist

-- 1. Check table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'customers' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check total records
SELECT COUNT(*) as total_customers FROM customers;

-- 3. Sample data (first 3 records)
SELECT * FROM customers LIMIT 3;
