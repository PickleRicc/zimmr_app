-- RPC function to create craftsman records with elevated privileges
-- This function can bypass RLS policies when called with service role key
-- Run this in your Supabase SQL editor

CREATE OR REPLACE FUNCTION create_craftsman_for_user(
  user_id_param UUID,
  name_param TEXT,
  phone_param TEXT DEFAULT NULL,
  specialty_param TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to run with elevated privileges
AS $$
DECLARE
  craftsman_id UUID;
BEGIN
  -- Check if craftsman already exists
  SELECT id INTO craftsman_id
  FROM craftsmen
  WHERE user_id = user_id_param;
  
  -- If craftsman exists, return the existing ID
  IF craftsman_id IS NOT NULL THEN
    RETURN craftsman_id;
  END IF;
  
  -- Create new craftsman record
  INSERT INTO craftsmen (
    user_id,
    name,
    phone,
    specialty,
    availability_hours,
    created_at,
    updated_at
  ) VALUES (
    user_id_param,
    name_param,
    phone_param,
    specialty_param,
    NULL,
    NOW(),
    NOW()
  )
  RETURNING id INTO craftsman_id;
  
  RETURN craftsman_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and re-raise
    RAISE NOTICE 'Error creating craftsman for user %: %', user_id_param, SQLERRM;
    RAISE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_craftsman_for_user(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- Also grant to anon role in case it's needed
GRANT EXECUTE ON FUNCTION create_craftsman_for_user(UUID, TEXT, TEXT, TEXT) TO anon;
