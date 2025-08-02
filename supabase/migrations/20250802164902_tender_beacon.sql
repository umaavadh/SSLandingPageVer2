/*
  # Fix ambiguous column reference in save_consultation_progress function

  1. Problem
    - The `save_consultation_progress` function has ambiguous column reference for `project_description`
    - Parameter names conflict with table column names

  2. Solution
    - Rename function parameters with underscore prefix to avoid conflicts
    - Update function logic to use the renamed parameters
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS save_consultation_progress(uuid, text, jsonb);

-- Recreate the function with properly named parameters
CREATE OR REPLACE FUNCTION save_consultation_progress(
  _client_id uuid,
  _project_description text,
  _conversation_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  consultation_id uuid;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user matches the client_id
  IF auth.uid() != _client_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Insert or update consultation history
  INSERT INTO consultation_history (
    client_id,
    project_description,
    conversation_data,
    updated_at
  )
  VALUES (
    _client_id,
    _project_description,
    _conversation_data,
    now()
  )
  ON CONFLICT (client_id, project_description)
  DO UPDATE SET
    conversation_data = _conversation_data,
    updated_at = now()
  RETURNING id INTO consultation_id;

  RETURN consultation_id;
END;
$$;