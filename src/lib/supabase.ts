import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auth functions
export const signUp = async (email: string, password: string, userType: 'freelancer' | 'client') => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        user_type: userType
      }
    }
  })
  return { data, error }
}

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  return { data, error }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}

// Profile functions
export const getUserProfile = async () => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .single()
  return { data, error }
}

export const updateUserProfile = async (profileData: any) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(profileData)
    .select()
    .single()
  return { data, error }
}

// Consultation functions
export const saveConsultationProgress = async (
  projectDescription: string,
  conversationHistory: any[],
  aiResponse: any,
  checklistGenerated: boolean
) => {
  const { data, error } = await supabase.rpc('save_consultation_progress', {
    _project_description: projectDescription,
    _conversation_data: conversationHistory,
    _ai_response_data: aiResponse,
    _checklist_generated: checklistGenerated
  })
  return { data, error }
}

export const createProjectFromConsultation = async (
  consultationId: string,
  projectName: string,
  freelancerId: string,
  completionDate: string,
  projectAmount: number
) => {
  const { data, error } = await supabase.rpc('create_project_from_ai_consultation', {
    _consultation_id: consultationId,
    _project_name: projectName,
    _freelancer_id_input: freelancerId,
    _completion_date: completionDate,
    _project_amount: projectAmount
  })
  return { data, error }
}

// Project functions
export const getProjects = async () => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
  return { data, error }
}

export const getProjectDeliverables = async (projectId: string) => {
  const { data, error } = await supabase
    .from('project_deliverables')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  return { data, error }
}

// Conversation functions
export const getProjectConversations = async () => {
  const { data, error } = await supabase
    .from('project_conversations')
    .select('*')
    .order('updated_at', { ascending: false })
  return { data, error }
}

export const saveProjectConversation = async (
  projectId: string,
  projectName: string,
  messages: any[],
  parametersCollected: number
) => {
  const { data, error } = await supabase
    .from('project_conversations')
    .upsert({
      project_id: projectId,
      project_name: projectName,
      messages: messages,
      parameters_collected: parametersCollected,
      updated_at: new Date().toISOString()
    })
    .select()
    .single()
  return { data, error }
}

export const deleteProjectConversation = async (conversationId: string) => {
  const { error } = await supabase
    .from('project_conversations')
    .delete()
    .eq('id', conversationId)
  return { error }
}

// Consultation history functions
export const getConsultationHistory = async () => {
  const { data, error } = await supabase
    .from('consultation_history')
    .select('*')
    .order('created_at', { ascending: false })
  return { data, error }
}