import { supabase } from './supabase'

// Types for the generateChecklist function
export interface ChecklistItem {
  id: string
  category: string
  requirement: string
  description: string
  priority: 'high' | 'medium' | 'low'
  verifiable: boolean
}

export interface ChecklistResponse {
  success: boolean
  checklist?: ChecklistItem[]
  totalItems?: number
  estimatedDuration?: string
  error?: string
}

/**
 * Generate a project checklist using AI
 * @param description - The video project description
 * @returns Promise<ChecklistResponse>
 */
export const generateChecklist = async (description: string): Promise<ChecklistResponse> => {
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

    // Call the edge function
    const { data, error } = await supabase.functions.invoke('generate-checklist', {
      body: { description: description.trim() }
    })

    if (error) {
      console.error('Edge function error:', error)
      return {
        success: false,
        error: error.message || 'Failed to generate checklist'
      }
    }

    // Validate response
    if (!data || typeof data !== 'object') {
      return {
        success: false,
        error: 'Invalid response from checklist service'
      }
    }

    return data as ChecklistResponse

  } catch (error) {
    console.error('Error calling generateChecklist:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while generating the checklist'
    }
  }
}

// Example usage:
/*
import { generateChecklist } from '../lib/edgeFunctions'

const handleGenerateChecklist = async () => {
  const description = "Create a 60-second promotional video for our tech startup, featuring product demos, customer testimonials, and a call-to-action. The video should be modern, professional, and optimized for social media platforms."
  
  const result = await generateChecklist(description)
  
  if (result.success && result.checklist) {
    console.log('Generated checklist:', result.checklist)
    console.log('Total items:', result.totalItems)
    console.log('Estimated duration:', result.estimatedDuration)
  } else {
    console.error('Error:', result.error)
  }
}
*/