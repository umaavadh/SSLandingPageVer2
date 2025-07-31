/*
  # Create User Profiles and Projects Schema

  1. New Tables
    - `user_profiles`
      - `id` (uuid, primary key, references auth.users)
      - `user_type` (text, 'freelancer' or 'client')
      - `full_name` (text)
      - `mobile_number` (text)
      - `country_code` (text, default '+91')
      - `company_name` (text, nullable for freelancers)
      - `gst_number` (text, nullable)
      - `upi_id` (text, nullable for clients)
      - `aadhar_number` (text, nullable for clients)
      - `freelancer_id` (text, nullable, unique)
      - `client_id` (text, nullable, unique)
      - `profile_completed` (boolean, default false)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

    - `projects`
      - `id` (uuid, primary key)
      - `client_id` (uuid, references user_profiles.id)
      - `freelancer_id` (uuid, nullable, references user_profiles.id)
      - `project_name` (text)
      - `description` (text)
      - `category` (text, default 'Video Production')
      - `completion_date` (date)
      - `status` (text, default 'draft')
      - `amount` (decimal, nullable)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

    - `project_deliverables`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects.id)
      - `requirement` (text)
      - `description` (text)
      - `category` (text)
      - `priority` (text)
      - `verifiable` (boolean, default true)
      - `completed` (boolean, default false)
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Add policies for project collaboration between clients and freelancers

  3. Functions
    - Auto-update updated_at timestamps
    - Generate unique freelancer/client IDs
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type text NOT NULL CHECK (user_type IN ('freelancer', 'client')),
  full_name text,
  mobile_number text,
  country_code text DEFAULT '+91',
  company_name text,
  gst_number text,
  upi_id text,
  aadhar_number text,
  freelancer_id text UNIQUE,
  client_id text UNIQUE,
  profile_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  freelancer_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  project_name text NOT NULL,
  description text NOT NULL,
  category text DEFAULT 'Video Production',
  completion_date date,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  amount decimal(10,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create project_deliverables table
CREATE TABLE IF NOT EXISTS project_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requirement text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  verifiable boolean DEFAULT true,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_deliverables ENABLE ROW LEVEL SECURITY;

-- Create policies for user_profiles
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create policies for projects
CREATE POLICY "Clients can read own projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (client_id = auth.uid() OR freelancer_id = auth.uid());

CREATE POLICY "Clients can insert own projects"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "Clients can update own projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- Create policies for project_deliverables
CREATE POLICY "Users can read project deliverables"
  ON project_deliverables
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_deliverables.project_id 
      AND (projects.client_id = auth.uid() OR projects.freelancer_id = auth.uid())
    )
  );

CREATE POLICY "Clients can insert project deliverables"
  ON project_deliverables
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_deliverables.project_id 
      AND projects.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can update project deliverables"
  ON project_deliverables
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_deliverables.project_id 
      AND projects.client_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_deliverables.project_id 
      AND projects.client_id = auth.uid()
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique freelancer ID
CREATE OR REPLACE FUNCTION generate_freelancer_id(user_email text)
RETURNS text AS $$
DECLARE
  hash_value bigint;
  id_number text;
BEGIN
  -- Create a hash from the email
  hash_value := abs(hashtext(user_email));
  -- Convert to 9-digit string
  id_number := lpad((hash_value % 1000000000)::text, 9, '0');
  RETURN 'F' || id_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate unique client ID
CREATE OR REPLACE FUNCTION generate_client_id(user_email text)
RETURNS text AS $$
DECLARE
  hash_value bigint;
  id_number text;
BEGIN
  -- Create a hash from the email
  hash_value := abs(hashtext(user_email));
  -- Convert to 9-digit string
  id_number := lpad((hash_value % 1000000000)::text, 9, '0');
  RETURN 'C' || id_number;
END;
$$ LANGUAGE plpgsql;

-- Function to create user profile after signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, user_type, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'freelancer'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile on user signup
CREATE TRIGGER create_profile_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile();