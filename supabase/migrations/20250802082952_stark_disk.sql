/*
  # Create project conversations table for persistent chat history

  1. New Tables
    - `project_conversations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `project_id` (text, unique identifier for project)
      - `project_name` (text, user-defined title)
      - `messages` (jsonb, array of chat messages)
      - `parameters_collected` (integer, count of collected parameters)
      - `status` (text, project status)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `project_conversations` table
    - Add policies for users to manage their own conversations
*/

CREATE TABLE IF NOT EXISTS project_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  project_name text,
  messages jsonb DEFAULT '[]'::jsonb,
  parameters_collected integer DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create unique index on user_id and project_id combination
CREATE UNIQUE INDEX IF NOT EXISTS project_conversations_user_project_idx 
ON project_conversations(user_id, project_id);

-- Enable RLS
ALTER TABLE project_conversations ENABLE ROW LEVEL SECURITY;

-- Policies for project conversations
CREATE POLICY "Users can read own conversations"
  ON project_conversations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON project_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON project_conversations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON project_conversations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_project_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_conversations_updated_at
  BEFORE UPDATE ON project_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_project_conversations_updated_at();