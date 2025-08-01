import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auth helper functions
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

// Profile management functions
export const getUserProfile = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error('No authenticated user') }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return { data, error }
}

export const updateUserProfile = async (profileData: any) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error('No authenticated user') }

  // Generate IDs if completing profile for the first time
  if (profileData.profile_completed && !profileData.freelancer_id && !profileData.client_id) {
    if (profileData.user_type === 'freelancer') {
      const { data: idData } = await supabase.rpc('generate_freelancer_id', { user_email: user.email })
      profileData.freelancer_id = idData
    } else if (profileData.user_type === 'client') {
      const { data: idData } = await supabase.rpc('generate_client_id', { user_email: user.email })
      profileData.client_id = idData
    }
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert({ id: user.id, ...profileData })
    .select()
    .single()

  return { data, error }
}

// Project management functions
export const createProject = async (projectData: any, deliverables: any[]) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error('No authenticated user') }

  // Use the database function to create project with deliverables
  const { data, error } = await supabase.rpc('create_project_with_deliverables', {
    project_data: projectData,
    deliverables_data: deliverables
  })

  return { data, error }
}

export const getUserProjects = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error('No authenticated user') }

  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      project_deliverables (*)
    `)
    .or(`client_id.eq.${user.id},freelancer_id.eq.${user.id}`)
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

// New project management functions
export const updateProjectStatus = async (projectId: string, status: string) => {
  const { data, error } = await supabase.rpc('update_project_status', {
    project_id: projectId,
    new_status: status
  })

  return { data, error }
}

export const assignFreelancerToProject = async (projectId: string, freelancerId: string) => {
  const { data, error } = await supabase.rpc('assign_freelancer_to_project', {
    project_id: projectId,
    freelancer_user_id: freelancerId
  })

  return { data, error }
}

export const markDeliverableCompleted = async (deliverableId: string, isCompleted: boolean = true) => {
  const { data, error } = await supabase.rpc('mark_deliverable_completed', {
    deliverable_id: deliverableId,
    is_completed: isCompleted
  })

  return { data, error }
}

export const getProjectStats = async () => {
  const { data, error } = await supabase.rpc('get_project_stats')
  return { data, error }
}

export const getProjectById = async (projectId: string) => {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      project_deliverables (*),
      client:user_profiles!projects_client_id_fkey (
        full_name,
        company_name,
        client_id
      ),
      freelancer:user_profiles!projects_freelancer_id_fkey (
        full_name,
        freelancer_id
      )
    `)
    .eq('id', projectId)
    .single()

  return { data, error }
}

// New consultation and project creation functions
export const saveConsultationProgress = async (
  projectDescription: string,
  conversationHistory: any[],
  aiResponse?: any,
  checklistGenerated: boolean = false
) => {
  const { data, error } = await supabase.rpc('save_consultation_progress', {
    project_description: projectDescription,
    conversation_history: conversationHistory,
    ai_response: aiResponse,
    checklist_generated: checklistGenerated
  })

  return { data, error }
}

export const createProjectFromConsultation = async (
  consultationId: string,
  projectName: string,
  freelancerId?: string,
  completionDate?: string,
  projectAmount?: number
) => {
  const { data, error } = await supabase.rpc('create_project_from_ai_consultation', {
    consultation_id: consultationId,
    project_name: projectName,
    freelancer_id_input: freelancerId,
    completion_date: completionDate,
    project_amount: projectAmount
  })

  return { data, error }
}

export const getProjectWithFullDetails = async (projectId: string) => {
  const { data, error } = await supabase.rpc('get_project_with_full_details', {
    project_id: projectId
  })

  return { data, error }
}

export const getUserConsultations = async () => {
  const { data, error } = await supabase.rpc('get_user_consultations')
  return { data, error }
}

export const getEnhancedProjectStats = async () => {
  const { data, error } = await supabase.rpc('get_enhanced_project_stats')
  return { data, error }
}