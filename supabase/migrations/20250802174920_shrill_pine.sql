/*
  # Fix Consultation Functions - Ambiguous Column References and UUID Issues

  1. Database Functions
    - Fix ambiguous column references in save_consultation_progress
    - Fix parameter handling in create_project_from_ai_consultation
    - Add proper error handling and validation

  2. Security
    - Maintain RLS policies
    - Proper user authentication checks
*/

-- Drop existing functions to recreate them with fixes
DROP FUNCTION IF EXISTS save_consultation_progress(text, jsonb, jsonb, boolean);
DROP FUNCTION IF EXISTS create_project_from_ai_consultation(uuid, text, text, date, numeric);

-- Fixed save_consultation_progress function with proper column qualification
CREATE OR REPLACE FUNCTION save_consultation_progress(
  _project_description text,
  _conversation_data jsonb DEFAULT '[]'::jsonb,
  _ai_response_data jsonb DEFAULT NULL,
  _checklist_generated boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _user_id uuid;
  _consultation_id uuid;
BEGIN
  -- Get authenticated user
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Validate input
  IF _project_description IS NULL OR trim(_project_description) = '' THEN
    RAISE EXCEPTION 'Project description is required';
  END IF;

  -- Insert or update consultation record
  INSERT INTO consultation_history (
    client_id,
    project_description,
    conversation_data,
    ai_response_data,
    checklist_generated
  )
  VALUES (
    _user_id,
    trim(_project_description),
    COALESCE(_conversation_data, '[]'::jsonb),
    _ai_response_data,
    COALESCE(_checklist_generated, false)
  )
  ON CONFLICT (client_id, project_description)
  DO UPDATE SET
    conversation_data = COALESCE(_conversation_data, consultation_history.conversation_data),
    ai_response_data = COALESCE(_ai_response_data, consultation_history.ai_response_data),
    checklist_generated = COALESCE(_checklist_generated, consultation_history.checklist_generated),
    updated_at = now()
  RETURNING consultation_history.id INTO _consultation_id;

  RETURN _consultation_id;
END;
$$;

-- Fixed create_project_from_ai_consultation function with proper UUID validation
CREATE OR REPLACE FUNCTION create_project_from_ai_consultation(
  _consultation_id uuid,
  _project_name text,
  _freelancer_id_input text DEFAULT NULL,
  _completion_date date DEFAULT NULL,
  _project_amount numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _user_id uuid;
  _consultation_record record;
  _project_id uuid;
  _freelancer_user_id uuid;
  _checklist_items jsonb;
  _item jsonb;
BEGIN
  -- Get authenticated user
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Validate consultation_id
  IF _consultation_id IS NULL THEN
    RAISE EXCEPTION 'Consultation ID is required';
  END IF;

  -- Validate project name
  IF _project_name IS NULL OR trim(_project_name) = '' THEN
    RAISE EXCEPTION 'Project name is required';
  END IF;

  -- Get consultation record
  SELECT * INTO _consultation_record
  FROM consultation_history
  WHERE consultation_history.id = _consultation_id 
    AND consultation_history.client_id = _user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consultation not found or access denied';
  END IF;

  -- Validate freelancer ID if provided
  IF _freelancer_id_input IS NOT NULL AND trim(_freelancer_id_input) != '' THEN
    SELECT user_profiles.id INTO _freelancer_user_id
    FROM user_profiles
    WHERE user_profiles.freelancer_id = trim(_freelancer_id_input)
      AND user_profiles.user_type = 'freelancer';
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Freelancer not found with ID: %', _freelancer_id_input;
    END IF;
  END IF;

  -- Create project
  INSERT INTO projects (
    client_id,
    freelancer_id,
    project_name,
    description,
    category,
    completion_date,
    amount,
    status
  )
  VALUES (
    _user_id,
    _freelancer_user_id,
    trim(_project_name),
    _consultation_record.project_description,
    'Video Production',
    _completion_date,
    _project_amount,
    CASE WHEN _freelancer_user_id IS NOT NULL THEN 'active' ELSE 'draft' END
  )
  RETURNING projects.id INTO _project_id;

  -- Extract checklist from AI response and create deliverables
  IF _consultation_record.ai_response_data IS NOT NULL 
     AND _consultation_record.ai_response_data ? 'checklist' THEN
    
    _checklist_items := _consultation_record.ai_response_data->'checklist';
    
    FOR _item IN SELECT * FROM jsonb_array_elements(_checklist_items)
    LOOP
      INSERT INTO project_deliverables (
        project_id,
        requirement,
        description,
        category,
        priority,
        verifiable
      )
      VALUES (
        _project_id,
        COALESCE(_item->>'requirement', 'Deliverable'),
        COALESCE(_item->>'description', 'No description provided'),
        COALESCE(_item->>'category', 'General'),
        CASE 
          WHEN (_item->>'priority') IN ('high', 'medium', 'low') 
          THEN (_item->>'priority')::text
          ELSE 'medium'
        END,
        COALESCE((_item->>'verifiable')::boolean, true)
      );
    END LOOP;
  END IF;

  -- Mark consultation as project created
  UPDATE consultation_history
  SET 
    project_created = true,
    updated_at = now()
  WHERE consultation_history.id = _consultation_id;

  RETURN _project_id;
END;
$$;