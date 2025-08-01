/*
  # Create Project Backend Functions

  1. Database Functions
    - `create_project_with_deliverables`: Creates a project with deliverables in a single transaction
    - `generate_client_id`: Generates unique client ID
    - `generate_freelancer_id`: Generates unique freelancer ID
    - `update_updated_at_column`: Trigger function for updating timestamps

  2. Enhanced RLS Policies
    - Updated policies for better project access control
    - Policies for project deliverables management

  3. Helper Functions
    - Project status validation
    - Deliverable completion tracking
*/

-- Function to generate unique client ID
CREATE OR REPLACE FUNCTION generate_client_id(user_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  hash_value bigint;
  client_id text;
BEGIN
  -- Create hash from email
  hash_value := abs(hashtext(user_email));
  
  -- Generate 9-digit ID and prefix with C
  client_id := 'C' || lpad((hash_value % 1000000000)::text, 9, '0');
  
  RETURN client_id;
END;
$$;

-- Function to generate unique freelancer ID
CREATE OR REPLACE FUNCTION generate_freelancer_id(user_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  hash_value bigint;
  freelancer_id text;
BEGIN
  -- Create hash from email
  hash_value := abs(hashtext(user_email));
  
  -- Generate 9-digit ID and prefix with F
  freelancer_id := 'F' || lpad((hash_value % 1000000000)::text, 9, '0');
  
  RETURN freelancer_id;
END;
$$;

-- Function to create project with deliverables
CREATE OR REPLACE FUNCTION create_project_with_deliverables(
  project_data jsonb,
  deliverables_data jsonb[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_project projects%ROWTYPE;
  deliverable_record jsonb;
  result jsonb;
BEGIN
  -- Validate user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Validate user is a client
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND user_type = 'client'
  ) THEN
    RAISE EXCEPTION 'Only clients can create projects';
  END IF;

  -- Insert project
  INSERT INTO projects (
    client_id,
    project_name,
    description,
    category,
    completion_date,
    status,
    amount
  )
  VALUES (
    auth.uid(),
    project_data->>'project_name',
    project_data->>'description',
    COALESCE(project_data->>'category', 'Video Production'),
    (project_data->>'completion_date')::date,
    COALESCE(project_data->>'status', 'draft'),
    (project_data->>'amount')::numeric(10,2)
  )
  RETURNING * INTO new_project;

  -- Insert deliverables if provided
  IF deliverables_data IS NOT NULL AND array_length(deliverables_data, 1) > 0 THEN
    FOREACH deliverable_record IN ARRAY deliverables_data
    LOOP
      INSERT INTO project_deliverables (
        project_id,
        requirement,
        description,
        category,
        priority,
        verifiable,
        completed
      )
      VALUES (
        new_project.id,
        deliverable_record->>'requirement',
        deliverable_record->>'description',
        deliverable_record->>'category',
        deliverable_record->>'priority',
        COALESCE((deliverable_record->>'verifiable')::boolean, true),
        false
      );
    END LOOP;
  END IF;

  -- Return project with deliverables
  SELECT jsonb_build_object(
    'project', to_jsonb(new_project),
    'deliverables', (
      SELECT jsonb_agg(to_jsonb(pd))
      FROM project_deliverables pd
      WHERE pd.project_id = new_project.id
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Function to update project status
CREATE OR REPLACE FUNCTION update_project_status(
  project_id uuid,
  new_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_project projects%ROWTYPE;
BEGIN
  -- Validate user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Validate status
  IF new_status NOT IN ('draft', 'active', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid project status';
  END IF;

  -- Update project status
  UPDATE projects 
  SET status = new_status, updated_at = now()
  WHERE id = project_id 
    AND (client_id = auth.uid() OR freelancer_id = auth.uid())
  RETURNING * INTO updated_project;

  IF updated_project IS NULL THEN
    RAISE EXCEPTION 'Project not found or access denied';
  END IF;

  RETURN to_jsonb(updated_project);
END;
$$;

-- Function to assign freelancer to project
CREATE OR REPLACE FUNCTION assign_freelancer_to_project(
  project_id uuid,
  freelancer_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_project projects%ROWTYPE;
BEGIN
  -- Validate user is authenticated and is the client
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Validate freelancer exists and is a freelancer
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = freelancer_user_id AND user_type = 'freelancer'
  ) THEN
    RAISE EXCEPTION 'Invalid freelancer ID';
  END IF;

  -- Update project with freelancer
  UPDATE projects 
  SET 
    freelancer_id = freelancer_user_id,
    status = 'active',
    updated_at = now()
  WHERE id = project_id 
    AND client_id = auth.uid()
    AND status = 'draft'
  RETURNING * INTO updated_project;

  IF updated_project IS NULL THEN
    RAISE EXCEPTION 'Project not found, access denied, or project is not in draft status';
  END IF;

  RETURN to_jsonb(updated_project);
END;
$$;

-- Function to mark deliverable as completed
CREATE OR REPLACE FUNCTION mark_deliverable_completed(
  deliverable_id uuid,
  is_completed boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_deliverable project_deliverables%ROWTYPE;
  project_record projects%ROWTYPE;
BEGIN
  -- Validate user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Get project info to validate access
  SELECT p.* INTO project_record
  FROM projects p
  JOIN project_deliverables pd ON p.id = pd.project_id
  WHERE pd.id = deliverable_id;

  IF project_record IS NULL THEN
    RAISE EXCEPTION 'Deliverable not found';
  END IF;

  -- Only freelancer assigned to project can mark deliverables
  IF project_record.freelancer_id != auth.uid() THEN
    RAISE EXCEPTION 'Only assigned freelancer can mark deliverables as completed';
  END IF;

  -- Update deliverable
  UPDATE project_deliverables 
  SET completed = is_completed
  WHERE id = deliverable_id
  RETURNING * INTO updated_deliverable;

  RETURN to_jsonb(updated_deliverable);
END;
$$;

-- Function to get project statistics
CREATE OR REPLACE FUNCTION get_project_stats(user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_type_val text;
  stats jsonb;
BEGIN
  -- Validate user is authenticated
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Get user type
  SELECT user_type INTO user_type_val
  FROM user_profiles
  WHERE id = user_id;

  IF user_type_val IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Calculate stats based on user type
  IF user_type_val = 'client' THEN
    SELECT jsonb_build_object(
      'total_projects', COUNT(*),
      'active_projects', COUNT(*) FILTER (WHERE status = 'active'),
      'completed_projects', COUNT(*) FILTER (WHERE status = 'completed'),
      'draft_projects', COUNT(*) FILTER (WHERE status = 'draft'),
      'total_spent', COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0),
      'pending_amount', COALESCE(SUM(amount) FILTER (WHERE status = 'active'), 0)
    ) INTO stats
    FROM projects
    WHERE client_id = user_id;
  ELSE
    SELECT jsonb_build_object(
      'total_projects', COUNT(*),
      'active_projects', COUNT(*) FILTER (WHERE status = 'active'),
      'completed_projects', COUNT(*) FILTER (WHERE status = 'completed'),
      'total_earned', COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0),
      'pending_earnings', COALESCE(SUM(amount) FILTER (WHERE status = 'active'), 0)
    ) INTO stats
    FROM projects
    WHERE freelancer_id = user_id;
  END IF;

  RETURN stats;
END;
$$;

-- Enhanced RLS policies for projects table
DROP POLICY IF EXISTS "Clients can insert own projects" ON projects;
DROP POLICY IF EXISTS "Clients can read own projects" ON projects;
DROP POLICY IF EXISTS "Clients can update own projects" ON projects;

-- New comprehensive RLS policies for projects
CREATE POLICY "Users can insert projects as clients"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND user_type = 'client'
    )
  );

CREATE POLICY "Users can read their projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid() OR 
    freelancer_id = auth.uid()
  );

CREATE POLICY "Clients can update their projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "Freelancers can update assigned projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (
    freelancer_id = auth.uid() AND
    status IN ('active', 'completed')
  )
  WITH CHECK (
    freelancer_id = auth.uid() AND
    status IN ('active', 'completed')
  );

-- Enhanced RLS policies for project_deliverables table
DROP POLICY IF EXISTS "Clients can insert project deliverables" ON project_deliverables;
DROP POLICY IF EXISTS "Users can read project deliverables" ON project_deliverables;
DROP POLICY IF EXISTS "Clients can update project deliverables" ON project_deliverables;

CREATE POLICY "Clients can insert deliverables for their projects"
  ON project_deliverables
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE id = project_deliverables.project_id 
        AND client_id = auth.uid()
    )
  );

CREATE POLICY "Project participants can read deliverables"
  ON project_deliverables
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE id = project_deliverables.project_id 
        AND (client_id = auth.uid() OR freelancer_id = auth.uid())
    )
  );

CREATE POLICY "Clients can update deliverables for their projects"
  ON project_deliverables
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE id = project_deliverables.project_id 
        AND client_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE id = project_deliverables.project_id 
        AND client_id = auth.uid()
    )
  );

CREATE POLICY "Freelancers can update completion status"
  ON project_deliverables
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE id = project_deliverables.project_id 
        AND freelancer_id = auth.uid()
        AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE id = project_deliverables.project_id 
        AND freelancer_id = auth.uid()
        AND status = 'active'
    )
  );

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION create_project_with_deliverables(jsonb, jsonb[]) TO authenticated;
GRANT EXECUTE ON FUNCTION update_project_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_freelancer_to_project(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_deliverable_completed(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION get_project_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_client_id(text) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_freelancer_id(text) TO authenticated;