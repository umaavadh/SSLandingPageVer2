import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Check if credentials are properly configured
const hasValidCredentials = supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('placeholder') && 
  !supabaseAnonKey.includes('placeholder') &&
  supabaseUrl.startsWith('https://') &&
  supabaseAnonKey.length > 20

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auth helper functions
export const signUp = async (email: string, password: string, userType: 'freelancer' | 'client') => {
  if (!hasValidCredentials) {
    return { 
      data: null, 
      error: new Error('Please configure your Supabase credentials in the .env file. Check the README.md for setup instructions.') 
    }
  }
  
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
  if (!hasValidCredentials) {
    return { 
      data: null, 
      error: new Error('Please configure your Supabase credentials in the .env file. Check the README.md for setup instructions.') 
    }
  }
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  return { data, error }
}

export const signOut = async () => {
  if (!hasValidCredentials) {
    return { error: new Error('Supabase not configured') }
  }
  
  const { error } = await supabase.auth.signOut()
  return { error }
}

export const getCurrentUser = async () => {
  if (!hasValidCredentials) {
    return { user: null, error: new Error('Supabase not configured') }
  }
  
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

  // Create project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({ client_id: user.id, ...projectData })
    .select()
    .single()

  if (projectError) return { data: null, error: projectError }

  // Create deliverables
  if (deliverables.length > 0) {
    const deliverableData = deliverables.map(deliverable => ({
      project_id: project.id,
      ...deliverable
    }))

    const { error: deliverablesError } = await supabase
      .from('project_deliverables')
      .insert(deliverableData)

    if (deliverablesError) return { data: null, error: deliverablesError }
  }

  return { data: project, error: null }
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