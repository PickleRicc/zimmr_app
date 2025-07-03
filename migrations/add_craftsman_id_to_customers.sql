-- Add craftsman_id column to customers table if it doesn't exist
ALTER TABLE customers ADD COLUMN IF NOT EXISTS craftsman_id INTEGER REFERENCES craftsmen(id);

-- Get the first craftsman ID to use as a default
DO $$
DECLARE
    default_craftsman_id INTEGER;
BEGIN
    -- Get the first craftsman ID from the database
    SELECT id INTO default_craftsman_id FROM craftsmen LIMIT 1;
    
    IF default_craftsman_id IS NOT NULL THEN
        -- Update all existing customers with NULL craftsman_id to use the default craftsman
        UPDATE customers SET craftsman_id = default_craftsman_id WHERE craftsman_id IS NULL;
        RAISE NOTICE 'Updated customers with default craftsman ID: %', default_craftsman_id;
    ELSE
        RAISE NOTICE 'No craftsmen found in the database. Customers will remain unassigned.';
    END IF;
END $$;

-- In the future, you might want to make craftsman_id required
-- Uncomment this after migrating existing data
-- ALTER TABLE customers ALTER COLUMN craftsman_id SET NOT NULL;
