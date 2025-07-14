-- Clean up duplicate craftsmen records
-- IMPORTANT: Run check_craftsmen_schema.sql first to see if you have duplicates
-- This script will keep the oldest record for each user_id and delete the rest

-- Step 1: Create a backup table (optional but recommended)
CREATE TABLE craftsmen_backup AS SELECT * FROM craftsmen;

-- Step 2: Delete duplicate records, keeping only the oldest one for each user_id
DELETE FROM craftsmen 
WHERE id NOT IN (
    SELECT DISTINCT ON (user_id) id
    FROM craftsmen 
    ORDER BY user_id, created_at ASC
);

-- Step 3: Add a unique constraint to prevent future duplicates
ALTER TABLE craftsmen 
ADD CONSTRAINT unique_user_id UNIQUE (user_id);

-- Step 4: Verify the cleanup worked
SELECT 
    user_id,
    COUNT(*) as record_count
FROM craftsmen 
GROUP BY user_id 
HAVING COUNT(*) > 1;

-- If the above query returns no rows, the cleanup was successful
