import { supabase } from './supabase'

// Types for the conversational generateChecklist function
export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface ChecklistItem {
  id: string
  category: string
  requirement: string
  description: string
  priority: 'high' | 'medium' | 'low'
  verifiable: boolean
}

export interface ConversationalResponse {
  success: boolean
  isComplete: boolean
  response?: string
  followUpQuestions?: string[]
  checklist?: ChecklistItem[]
  totalItems?: number
  estimatedDuration?: string
  conversationHistory?: ConversationMessage[]
  error?: string
}

/**
 * Generate a project checklist using conversational AI
 * @param description - The video project description
 * @param conversationHistory - Previous conversation messages
 * @param generateFinal - Force final checklist generation
 * @returns Promise<ConversationalResponse>
 */
export const generateChecklist = async (
  description: string, 
  conversationHistory?: ConversationMessage[],
  generateFinal?: boolean
): Promise<ConversationalResponse> => {
  try {
    // Validate input
    if (!description || typeof description !== 'string') {
      return {
        success: false,
        error: 'Description is required and must be a string'
      }
    }

    if (description.trim().length < 10) {
      return {
        success: false,
        error: 'Description must be at least 10 characters long'
      }
    }

    console.log('Calling conversational generateChecklist edge function...')

    // Call the edge function
    const { data, error } = await supabase.functions.invoke('generate-checklist', {
      body: { 
        description: description.trim(),
        conversationHistory: conversationHistory || [],
        generateFinal: generateFinal || false
      }
    })

    if (error) {
      console.error('Edge function error:', error)
      return {
        success: false,
        isComplete: false,
        error: error.message || error.details || 'Failed to generate response'
      }
    }

    console.log('Edge function response:', data)

    // Validate response
    if (!data || typeof data !== 'object') {
      return {
        success: false,
        isComplete: false,
        error: 'Invalid response from conversation service'
      }
    }

    // Check if the response indicates an error
    if (data.success === false) {
      return {
        success: false,
        isComplete: false,
        error: data.error || 'Unknown error from conversation service'
      }
    }

    return data as ConversationalResponse

  } catch (error) {
    console.error('Error calling conversational generateChecklist:', error)
    return {
      success: false,
      isComplete: false,
      error: 'An unexpected error occurred while processing the conversation'
    }
  }
}
