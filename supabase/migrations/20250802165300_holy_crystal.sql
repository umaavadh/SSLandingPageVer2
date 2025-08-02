/*
  # My Projects Backend System

  1. Enhanced Functions
    - Complete project management functions
    - Project status tracking
    - Deliverable management
    - File handling
    - Project analytics

  2. Security
    - Enhanced RLS policies
    - Role-based access control
    - Data validation

  3. Project Lifecycle Management
    - Status transitions
    - Progress tracking
    - Completion workflows
*/

-- Function to get all projects for a user with complete details
CREATE OR REPLACE FUNCTION get_user_projects_detailed()
RETURNS TABLE (
  project_id uuid,
  project_name text,
  description text,
  category text,
  status text,
  amount numeric(10,2),
  completion_date date,
  created_at timestamptz,
  updated_at timestamptz,
  client_name text,
  client_id_display text,
  freelancer_name text,
  freelancer_id_display text,
  total_deliverables bigint,
  completed_deliverables bigint,
  progress_percentage numeric(5,2),
  is_overdue boolean,
  days_remaining integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT 
    p.id as project_id,
    p.project_name,
    p.description,
    p.category,
    p.status,
    p.amount,
    p.completion_date,
    p.created_at,
    p.updated_at,
    client_profile.full_name as client_name,
    client_profile.client_id as client_id_display,
    freelancer_profile.full_name as freelancer_name,
    freelancer_profile.freelancer_id as freelancer_id_display,
    COALESCE(deliverable_stats.total_count, 0) as total_deliverables,
    COALESCE(deliverable_stats.completed_count, 0) as completed_deliverables,
    CASE 
      WHEN COALESCE(deliverable_stats.total_count, 0) = 0 THEN 0
      ELSE ROUND((COALESCE(deliverable_stats.completed_count, 0)::numeric / deliverable_stats.total_count::numeric) * 100, 2)
    END as progress_percentage,
    CASE 
      WHEN p.completion_date IS NOT NULL AND p.completion_date < CURRENT_DATE AND p.status != 'completed' THEN true
      ELSE false
    END as is_overdue,
    CASE 
      WHEN p.completion_date IS NOT NULL THEN (p.completion_date - CURRENT_DATE)::integer
      ELSE NULL
    END as days_remaining
  FROM projects p
  LEFT JOIN user_profiles client_profile ON p.client_id = client_profile.id
  LEFT JOIN user_profiles freelancer_profile ON p.freelancer_id = freelancer_profile.id
  LEFT JOIN (
    SELECT 
      project_id,
      COUNT(*) as total_count,
      COUNT(*) FILTER (WHERE completed = true) as completed_count
    FROM project_deliverables
    GROUP BY project_id
  ) deliverable_stats ON p.id = deliverable_stats.project_id
  WHERE p.client_id = auth.uid() OR p.freelancer_id = auth.uid()
  ORDER BY p.updated_at DESC;
END;
$$;

-- Function to get project details with deliverables
CREATE OR REPLACE FUNCTION get_project_with_deliverables(project_uuid uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  user_role text;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check if user has access to this project
  SELECT 
    CASE 
      WHEN client_id = auth.uid() THEN 'client'
      WHEN freelancer_id = auth.uid() THEN 'freelancer'
      ELSE NULL
    END INTO user_role
  FROM projects 
  WHERE id = project_uuid;

  IF user_role IS NULL THEN
    RAISE EXCEPTION 'Access denied to this project';
  END IF;

  -- Get complete project data
  SELECT json_build_object(
    'project', json_build_object(
      'id', p.id,
      'project_name', p.project_name,
      'description', p.description,
      'category', p.category,
      'status', p.status,
      'amount', p.amount,
      'completion_date', p.completion_date,
      'created_at', p.created_at,
      'updated_at', p.updated_at
    ),
    'client', json_build_object(
      'id', cp.id,
      'full_name', cp.full_name,
      'client_id', cp.client_id,
      'company_name', cp.company_name
    ),
    'freelancer', CASE 
      WHEN fp.id IS NOT NULL THEN json_build_object(
        'id', fp.id,
        'full_name', fp.full_name,
        'freelancer_id', fp.freelancer_id
      )
      ELSE NULL
    END,
    'deliverables', COALESCE(deliverables_array.deliverables, '[]'::json),
    'user_role', user_role,
    'statistics', json_build_object(
      'total_deliverables', COALESCE(stats.total_count, 0),
      'completed_deliverables', COALESCE(stats.completed_count, 0),
      'progress_percentage', CASE 
        WHEN COALESCE(stats.total_count, 0) = 0 THEN 0
        ELSE ROUND((COALESCE(stats.completed_count, 0)::numeric / stats.total_count::numeric) * 100, 2)
      END,
      'is_overdue', CASE 
        WHEN p.completion_date IS NOT NULL AND p.completion_date < CURRENT_DATE AND p.status != 'completed' THEN true
        ELSE false
      END,
      'days_remaining', CASE 
        WHEN p.completion_date IS NOT NULL THEN (p.completion_date - CURRENT_DATE)::integer
        ELSE NULL
      END
    )
  ) INTO result
  FROM projects p
  LEFT JOIN user_profiles cp ON p.client_id = cp.id
  LEFT JOIN user_profiles fp ON p.freelancer_id = fp.id
  LEFT JOIN (
    SELECT 
      project_id,
      json_agg(
        json_build_object(
          'id', id,
          'requirement', requirement,
          'description', description,
          'category', category,
          'priority', priority,
          'verifiable', verifiable,
          'completed', completed,
          'created_at', created_at
        ) ORDER BY created_at
      ) as deliverables
    FROM project_deliverables
    WHERE project_id = project_uuid
    GROUP BY project_id
  ) deliverables_array ON p.id = deliverables_array.project_id
  LEFT JOIN (
    SELECT 
      project_id,
      COUNT(*) as total_count,
      COUNT(*) FILTER (WHERE completed = true) as completed_count
    FROM project_deliverables
    WHERE project_id = project_uuid
    GROUP BY project_id
  ) stats ON p.id = stats.project_id
  WHERE p.id = project_uuid;

  RETURN result;
END;
$$;

-- Function to update project details (for clients)
CREATE OR REPLACE FUNCTION update_project_details(
  project_uuid uuid,
  new_project_name text DEFAULT NULL,
  new_description text DEFAULT NULL,
  new_completion_date date DEFAULT NULL,
  new_amount numeric(10,2) DEFAULT NULL,
  new_freelancer_id text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  freelancer_user_id uuid;
  result json;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check if user is the client of this project
  IF NOT EXISTS (
    SELECT 1 FROM projects 
    WHERE id = project_uuid AND client_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the project client can update project details';
  END IF;

  -- If freelancer_id is provided, validate and get user_id
  IF new_freelancer_id IS NOT NULL THEN
    SELECT id INTO freelancer_user_id
    FROM user_profiles 
    WHERE freelancer_id = new_freelancer_id AND user_type = 'freelancer';
    
    IF freelancer_user_id IS NULL THEN
      RAISE EXCEPTION 'Invalid freelancer ID: %', new_freelancer_id;
    END IF;
  END IF;

  -- Update project
  UPDATE projects SET
    project_name = COALESCE(new_project_name, project_name),
    description = COALESCE(new_description, description),
    completion_date = COALESCE(new_completion_date, completion_date),
    amount = COALESCE(new_amount, amount),
    freelancer_id = COALESCE(freelancer_user_id, freelancer_id),
    updated_at = now()
  WHERE id = project_uuid;

  -- Return updated project data
  SELECT get_project_with_deliverables(project_uuid) INTO result;
  
  RETURN result;
END;
$$;

-- Function to add deliverable to existing project
CREATE OR REPLACE FUNCTION add_project_deliverable(
  project_uuid uuid,
  new_requirement text,
  new_description text,
  new_category text DEFAULT 'General',
  new_priority text DEFAULT 'medium'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deliverable_id uuid;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check if user is the client of this project
  IF NOT EXISTS (
    SELECT 1 FROM projects 
    WHERE id = project_uuid AND client_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the project client can add deliverables';
  END IF;

  -- Validate priority
  IF new_priority NOT IN ('high', 'medium', 'low') THEN
    RAISE EXCEPTION 'Priority must be high, medium, or low';
  END IF;

  -- Insert new deliverable
  INSERT INTO project_deliverables (
    project_id,
    requirement,
    description,
    category,
    priority,
    verifiable,
    completed
  ) VALUES (
    project_uuid,
    new_requirement,
    new_description,
    new_category,
    new_priority,
    true,
    false
  ) RETURNING id INTO deliverable_id;

  -- Return the new deliverable
  RETURN json_build_object(
    'success', true,
    'deliverable_id', deliverable_id,
    'message', 'Deliverable added successfully'
  );
END;
$$;

-- Function to update deliverable
CREATE OR REPLACE FUNCTION update_project_deliverable(
  deliverable_uuid uuid,
  new_requirement text DEFAULT NULL,
  new_description text DEFAULT NULL,
  new_category text DEFAULT NULL,
  new_priority text DEFAULT NULL,
  new_completed boolean DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  project_uuid uuid;
  user_role text;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get project and determine user role
  SELECT 
    pd.project_id,
    CASE 
      WHEN p.client_id = auth.uid() THEN 'client'
      WHEN p.freelancer_id = auth.uid() THEN 'freelancer'
      ELSE NULL
    END
  INTO project_uuid, user_role
  FROM project_deliverables pd
  JOIN projects p ON pd.project_id = p.id
  WHERE pd.id = deliverable_uuid;

  IF user_role IS NULL THEN
    RAISE EXCEPTION 'Access denied to this deliverable';
  END IF;

  -- Validate priority if provided
  IF new_priority IS NOT NULL AND new_priority NOT IN ('high', 'medium', 'low') THEN
    RAISE EXCEPTION 'Priority must be high, medium, or low';
  END IF;

  -- Clients can update all fields except completion status
  -- Freelancers can only update completion status
  IF user_role = 'client' THEN
    UPDATE project_deliverables SET
      requirement = COALESCE(new_requirement, requirement),
      description = COALESCE(new_description, description),
      category = COALESCE(new_category, category),
      priority = COALESCE(new_priority, priority)
    WHERE id = deliverable_uuid;
  ELSIF user_role = 'freelancer' AND new_completed IS NOT NULL THEN
    UPDATE project_deliverables SET
      completed = new_completed
    WHERE id = deliverable_uuid;
  ELSIF user_role = 'freelancer' THEN
    RAISE EXCEPTION 'Freelancers can only update completion status';
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Deliverable updated successfully'
  );
END;
$$;

-- Function to delete deliverable (clients only)
CREATE OR REPLACE FUNCTION delete_project_deliverable(deliverable_uuid uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check if user is the client of this project
  IF NOT EXISTS (
    SELECT 1 FROM project_deliverables pd
    JOIN projects p ON pd.project_id = p.id
    WHERE pd.id = deliverable_uuid AND p.client_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the project client can delete deliverables';
  END IF;

  -- Delete deliverable
  DELETE FROM project_deliverables WHERE id = deliverable_uuid;

  RETURN json_build_object(
    'success', true,
    'message', 'Deliverable deleted successfully'
  );
END;
$$;

-- Function to get project analytics
CREATE OR REPLACE FUNCTION get_project_analytics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  user_type_val text;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get user type
  SELECT user_type INTO user_type_val
  FROM user_profiles
  WHERE id = auth.uid();

  -- Build analytics based on user type
  IF user_type_val = 'client' THEN
    SELECT json_build_object(
      'total_projects', COUNT(*),
      'active_projects', COUNT(*) FILTER (WHERE status = 'active'),
      'completed_projects', COUNT(*) FILTER (WHERE status = 'completed'),
      'draft_projects', COUNT(*) FILTER (WHERE status = 'draft'),
      'cancelled_projects', COUNT(*) FILTER (WHERE status = 'cancelled'),
      'total_amount_spent', COALESCE(SUM(amount), 0),
      'average_project_value', COALESCE(AVG(amount), 0),
      'overdue_projects', COUNT(*) FILTER (WHERE completion_date < CURRENT_DATE AND status != 'completed'),
      'projects_this_month', COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)),
      'completion_rate', CASE 
        WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND((COUNT(*) FILTER (WHERE status = 'completed')::numeric / COUNT(*)::numeric) * 100, 2)
      END
    ) INTO result
    FROM projects
    WHERE client_id = auth.uid();
  ELSIF user_type_val = 'freelancer' THEN
    SELECT json_build_object(
      'total_projects', COUNT(*),
      'active_projects', COUNT(*) FILTER (WHERE status = 'active'),
      'completed_projects', COUNT(*) FILTER (WHERE status = 'completed'),
      'total_earnings', COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0),
      'average_project_value', COALESCE(AVG(amount), 0),
      'overdue_projects', COUNT(*) FILTER (WHERE completion_date < CURRENT_DATE AND status != 'completed'),
      'projects_this_month', COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)),
      'completion_rate', CASE 
        WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND((COUNT(*) FILTER (WHERE status = 'completed')::numeric / COUNT(*)::numeric) * 100, 2)
      END
    ) INTO result
    FROM projects
    WHERE freelancer_id = auth.uid();
  ELSE
    RAISE EXCEPTION 'Invalid user type';
  END IF;

  RETURN result;
END;
$$;

-- Function to search projects
CREATE OR REPLACE FUNCTION search_projects(search_term text)
RETURNS TABLE (
  project_id uuid,
  project_name text,
  description text,
  status text,
  created_at timestamptz,
  relevance_score numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT 
    p.id as project_id,
    p.project_name,
    p.description,
    p.status,
    p.created_at,
    (
      CASE WHEN p.project_name ILIKE '%' || search_term || '%' THEN 3 ELSE 0 END +
      CASE WHEN p.description ILIKE '%' || search_term || '%' THEN 2 ELSE 0 END +
      CASE WHEN p.category ILIKE '%' || search_term || '%' THEN 1 ELSE 0 END
    )::numeric as relevance_score
  FROM projects p
  WHERE (p.client_id = auth.uid() OR p.freelancer_id = auth.uid())
    AND (
      p.project_name ILIKE '%' || search_term || '%' OR
      p.description ILIKE '%' || search_term || '%' OR
      p.category ILIKE '%' || search_term || '%'
    )
  ORDER BY relevance_score DESC, p.updated_at DESC;
END;
$$;

-- Enhanced RLS policies for better project access control
DROP POLICY IF EXISTS "Users can read their projects" ON projects;
DROP POLICY IF EXISTS "Users can insert projects as clients" ON projects;
DROP POLICY IF EXISTS "Clients can update their projects" ON projects;
DROP POLICY IF EXISTS "Freelancers can update assigned projects" ON projects;

-- New comprehensive RLS policies for projects
CREATE POLICY "Project owners can read projects"
  ON projects FOR SELECT
  TO authenticated
  USING (client_id = auth.uid() OR freelancer_id = auth.uid());

CREATE POLICY "Clients can insert projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND user_type = 'client'
    )
  );

CREATE POLICY "Clients can update own projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "Freelancers can update assigned project status"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    freelancer_id = auth.uid() AND
    status IN ('active', 'completed')
  )
  WITH CHECK (
    freelancer_id = auth.uid() AND
    status IN ('active', 'completed')
  );

-- Enhanced RLS policies for deliverables
DROP POLICY IF EXISTS "Project participants can read deliverables" ON project_deliverables;
DROP POLICY IF EXISTS "Clients can insert deliverables for their projects" ON project_deliverables;
DROP POLICY IF EXISTS "Clients can update deliverables for their projects" ON project_deliverables;
DROP POLICY IF EXISTS "Freelancers can update completion status" ON project_deliverables;

CREATE POLICY "Project participants can read deliverables"
  ON project_deliverables FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_deliverables.project_id
        AND (p.client_id = auth.uid() OR p.freelancer_id = auth.uid())
    )
  );

CREATE POLICY "Clients can manage deliverables"
  ON project_deliverables FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_deliverables.project_id
        AND p.client_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_deliverables.project_id
        AND p.client_id = auth.uid()
    )
  );

CREATE POLICY "Freelancers can update deliverable completion"
  ON project_deliverables FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_deliverables.project_id
        AND p.freelancer_id = auth.uid()
        AND p.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_deliverables.project_id
        AND p.freelancer_id = auth.uid()
        AND p.status = 'active'
    )
  );

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_user_projects_detailed() TO authenticated;
GRANT EXECUTE ON FUNCTION get_project_with_deliverables(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION update_project_details(uuid, text, text, date, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION add_project_deliverable(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_project_deliverable(uuid, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_project_deliverable(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_project_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION search_projects(text) TO authenticated;