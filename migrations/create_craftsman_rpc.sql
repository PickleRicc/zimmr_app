-- Create Stored Procedure to create a craftsman record
-- This RPC function allows bypassing RLS policies when needed
CREATE OR REPLACE FUNCTION create_craftsman_for_user(user_id_param UUID, name_param TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with permissions of the function creator (admin)
AS $$
DECLARE
  new_craftsman_id UUID;
BEGIN
  -- Check if craftsman already exists to avoid duplicates
  SELECT id INTO new_craftsman_id 
  FROM craftsmen
  WHERE user_id = user_id_param 
  LIMIT 1;
  
  -- If found, just return existing ID
  IF new_craftsman_id IS NOT NULL THEN
    RETURN new_craftsman_id;
  END IF;
  
  -- Create new craftsman if not found
  INSERT INTO craftsmen (
    user_id, 
    name, 
    created_at, 
    updated_at,
    active
  ) VALUES (
    user_id_param, 
    name_param, 
    NOW(), 
    NOW(),
    TRUE
  )
  RETURNING id INTO new_craftsman_id;
  
  RETURN new_craftsman_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_craftsman_for_user TO authenticated;
GRANT EXECUTE ON FUNCTION create_craftsman_for_user TO service_role;
