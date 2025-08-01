/*
  # Enhanced Project Creation System

  1. New Tables
    - Enhanced project creation with AI consultation data
    - Project conversation history tracking
    - Automated project generation after AI consultation

  2. Functions
    - create_project_from_ai_consultation: Creates project with AI-generated data
    - save_consultation_history: Saves AI conversation for reference
    - get_project_with_full_details: Retrieves complete project information

  3. Security
    - Enhanced RLS policies for new functionality
    - Proper access controls for consultation data
*/

-- Create consultation history table
CREATE TABLE IF NOT EXISTS consultation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  project_description text NOT NULL,
  conversation_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_response_data jsonb,
  checklist_generated boolean DEFAULT false,
  project_created boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on consultation_history
ALTER TABLE consultation_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for consultation_history
CREATE POLICY "Users can manage their own consultations"
  ON consultation_history
  FOR ALL
  TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_consultation_history_updated_at
  BEFORE UPDATE ON consultation_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enhanced project creation function that includes AI consultation data
CREATE OR REPLACE FUNCTION create_project_from_ai_consultation(
  consultation_id uuid,
  project_name text,
  freelancer_id_input text DEFAULT NULL,
  completion_date date DEFAULT NULL,
  project_amount numeric(10,2) DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  user_profile record;
  consultation_record record;
  new_project record;
  deliverable_item jsonb;
  deliverable_record record;
  result json;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get user profile and verify they are a client
  SELECT * INTO user_profile 
  FROM user_profiles 
  WHERE id = current_user_id AND user_type = 'client';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only clients can create projects';
  END IF;

  -- Get consultation record
  SELECT * INTO consultation_record
  FROM consultation_history
  WHERE id = consultation_id AND client_id = current_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consultation not found or access denied';
  END IF;

  -- Verify consultation has generated checklist
  IF NOT consultation_record.checklist_generated THEN
    RAISE EXCEPTION 'Consultation must have a generated checklist before creating project';
  END IF;

  -- Create the project
  INSERT INTO projects (
    client_id,
    project_name,
    description,
    category,
    completion_date,
    amount,
    status
  ) VALUES (
    current_user_id,
    project_name,
    consultation_record.project_description,
    'Video Production',
    COALESCE(completion_date, CURRENT_DATE + INTERVAL '14 days'),
    project_amount,
    'draft'
  ) RETURNING * INTO new_project;

  -- Create deliverables from AI-generated checklist
  IF consultation_record.ai_response_data ? 'checklist' THEN
    FOR deliverable_item IN SELECT * FROM jsonb_array_elements(consultation_record.ai_response_data->'checklist')
    LOOP
      INSERT INTO project_deliverables (
        project_id,
        requirement,
        description,
        category,
        priority,
        verifiable
      ) VALUES (
        new_project.id,
        deliverable_item->>'requirement',
        deliverable_item->>'description',
        deliverable_item->>'category',
        deliverable_item->>'priority',
        (deliverable_item->>'verifiable')::boolean
      );
    END LOOP;
  END IF;

  -- Update consultation record to mark project as created
  UPDATE consultation_history 
  SET 
    project_created = true,
    updated_at = now()
  WHERE id = consultation_id;

  -- Prepare result
  SELECT json_build_object(
    'success', true,
    'project', row_to_json(new_project),
    'message', 'Project created successfully from AI consultation'
  ) INTO result;

  RETURN result;
END;
$$;

-- Function to save consultation progress
CREATE OR REPLACE FUNCTION save_consultation_progress(
  project_description text,
  conversation_history jsonb,
  ai_response jsonb DEFAULT NULL,
  checklist_generated boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  consultation_record record;
  result json;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Insert or update consultation history
  INSERT INTO consultation_history (
    client_id,
    project_description,
    conversation_data,
    ai_response_data,
    checklist_generated
  ) VALUES (
    current_user_id,
    project_description,
    conversation_history,
    ai_response,
    checklist_generated
  )
  ON CONFLICT (client_id, project_description) 
  DO UPDATE SET
    conversation_data = EXCLUDED.conversation_data,
    ai_response_data = EXCLUDED.ai_response_data,
    checklist_generated = EXCLUDED.checklist_generated,
    updated_at = now()
  RETURNING * INTO consultation_record;

  SELECT json_build_object(
    'success', true,
    'consultation_id', consultation_record.id,
    'message', 'Consultation progress saved'
  ) INTO result;

  RETURN result;
END;
$$;

-- Function to get project with full details including deliverables
CREATE OR REPLACE FUNCTION get_project_with_full_details(project_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  project_record record;
  deliverables_array json;
  result json;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get project with access control
  SELECT p.*, 
         cp.full_name as client_name,
         cp.company_name,
         fp.full_name as freelancer_name,
         fp.freelancer_id
  INTO project_record
  FROM projects p
  LEFT JOIN user_profiles cp ON p.client_id = cp.id
  LEFT JOIN user_profiles fp ON p.freelancer_id = fp.id
  WHERE p.id = project_id 
    AND (p.client_id = current_user_id OR p.freelancer_id = current_user_id);
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found or access denied';
  END IF;

  -- Get deliverables
  SELECT json_agg(
    json_build_object(
      'id', id,
      'requirement', requirement,
      'description', description,
      'category', category,
      'priority', priority,
      'verifiable', verifiable,
      'completed', completed,
      'created_at', created_at
    )
  ) INTO deliverables_array
  FROM project_deliverables
  WHERE project_id = project_record.id
  ORDER BY created_at;

  -- Build result
  SELECT json_build_object(
    'success', true,
    'project', json_build_object(
      'id', project_record.id,
      'project_name', project_record.project_name,
      'description', project_record.description,
      'category', project_record.category,
      'status', project_record.status,
      'amount', project_record.amount,
      'completion_date', project_record.completion_date,
      'created_at', project_record.created_at,
      'updated_at', project_record.updated_at,
      'client_name', project_record.client_name,
      'company_name', project_record.company_name,
      'freelancer_name', project_record.freelancer_name,
      'freelancer_id', project_record.freelancer_id
    ),
    'deliverables', COALESCE(deliverables_array, '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

-- Function to get user's consultation history
CREATE OR REPLACE FUNCTION get_user_consultations()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  consultations_array json;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT json_agg(
    json_build_object(
      'id', id,
      'project_description', LEFT(project_description, 100) || CASE WHEN LENGTH(project_description) > 100 THEN '...' ELSE '' END,
      'checklist_generated', checklist_generated,
      'project_created', project_created,
      'created_at', created_at,
      'updated_at', updated_at
    )
    ORDER BY created_at DESC
  ) INTO consultations_array
  FROM consultation_history
  WHERE client_id = current_user_id;

  RETURN json_build_object(
    'success', true,
    'consultations', COALESCE(consultations_array, '[]'::json)
  );
END;
$$;

-- Enhanced project stats function
CREATE OR REPLACE FUNCTION get_enhanced_project_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  user_profile record;
  stats_result json;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get user profile
  SELECT * INTO user_profile FROM user_profiles WHERE id = current_user_id;
  
  IF user_profile.user_type = 'client' THEN
    -- Client stats
    SELECT json_build_object(
      'total_projects', COUNT(*),
      'active_projects', COUNT(*) FILTER (WHERE status = 'active'),
      'completed_projects', COUNT(*) FILTER (WHERE status = 'completed'),
      'draft_projects', COUNT(*) FILTER (WHERE status = 'draft'),
      'total_spent', COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0),
      'pending_amount', COALESCE(SUM(amount) FILTER (WHERE status = 'active'), 0)
    ) INTO stats_result
    FROM projects
    WHERE client_id = current_user_id;
    
  ELSIF user_profile.user_type = 'freelancer' THEN
    -- Freelancer stats
    SELECT json_build_object(
      'total_projects', COUNT(*),
      'active_projects', COUNT(*) FILTER (WHERE status = 'active'),
      'completed_projects', COUNT(*) FILTER (WHERE status = 'completed'),
      'total_earned', COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0),
      'pending_earnings', COALESCE(SUM(amount) FILTER (WHERE status = 'active'), 0)
    ) INTO stats_result
    FROM projects
    WHERE freelancer_id = current_user_id;
    
  ELSE
    stats_result := json_build_object(
      'total_projects', 0,
      'active_projects', 0,
      'completed_projects', 0,
      'total_spent', 0
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'stats', stats_result
  );
END;
$$;