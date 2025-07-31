/*
  # Generate Checklist Function

  This function takes a video project description and uses OpenAI's GPT-4o model
  to generate a structured checklist of deliverables and requirements.

  ## Input
  - `description`: Video project description from the user

  ## Output
  - Structured JSON checklist with deliverables, technical specs, and quality requirements
*/

import { corsHeaders } from '../_shared/cors.ts'

interface ChecklistRequest {
  description: string
}

interface ChecklistItem {
  id: string
  category: string
  requirement: string
  description: string
  priority: 'high' | 'medium' | 'low'
  verifiable: boolean
}

interface ChecklistResponse {
  success: boolean
  checklist?: ChecklistItem[]
  totalItems?: number
  estimatedDuration?: string
  error?: string
}

const SYSTEM_PROMPT = `You are an AI assistant specialized in creating comprehensive video production checklists. Your task is to analyze video project descriptions and generate detailed, verifiable deliverable checklists.

INSTRUCTIONS:
1. Create a structured checklist based on the project description
2. Include technical specifications, creative requirements, and delivery formats
3. Make each item specific and measurable for AI verification
4. Categorize items logically (Technical, Creative, Delivery, etc.)
5. Assign priority levels (high, medium, low)
6. Ensure all items are verifiable through automated analysis

CATEGORIES TO CONSIDER:
- Technical Specifications (resolution, format, frame rate, audio quality)
- Creative Elements (style, branding, transitions, effects)
- Content Requirements (duration, scenes, messaging)
- Delivery Formats (file types, compression, versions)
- Quality Standards (color grading, audio mixing, subtitles)

RESPONSE FORMAT:
Return a JSON object with this exact structure:
{
  "checklist": [
    {
      "id": "unique_id",
      "category": "Technical|Creative|Content|Delivery|Quality",
      "requirement": "Brief requirement title",
      "description": "Detailed description for verification",
      "priority": "high|medium|low",
      "verifiable": true|false
    }
  ],
  "totalItems": number,
  "estimatedDuration": "X hours/days"
}

Make the checklist comprehensive but practical, typically 8-15 items for most projects.`

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    // Validate request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Method not allowed. Use POST.' 
        }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Parse request body
    let requestData: ChecklistRequest
    try {
      requestData = await req.json()
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid JSON in request body' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate input
    if (!requestData.description || typeof requestData.description !== 'string') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Description is required and must be a string' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (requestData.description.trim().length < 10) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Description must be at least 10 characters long' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      console.error('OpenAI API key not found in environment variables')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'OpenAI API key not configured' 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Prepare OpenAI request
    const openaiRequest = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: `Please create a comprehensive video production checklist for this project:\n\n${requestData.description.trim()}`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    }

    // Call OpenAI API
    console.log('Calling OpenAI API for checklist generation...')
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(openaiRequest),
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('OpenAI API error:', errorText)
      
      // Handle specific OpenAI errors
      if (openaiResponse.status === 401) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Invalid OpenAI API key' 
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      } else if (openaiResponse.status === 429) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'OpenAI API rate limit exceeded. Please try again later.' 
          }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      } else {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to generate checklist. Please try again.' 
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
    }

    const openaiData = await openaiResponse.json()
    
    // Validate OpenAI response structure
    if (!openaiData.choices || !openaiData.choices[0] || !openaiData.choices[0].message) {
      console.error('Invalid OpenAI response structure:', openaiData)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid response from AI service' 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Parse the generated checklist
    let generatedChecklist
    try {
      generatedChecklist = JSON.parse(openaiData.choices[0].message.content)
    } catch (error) {
      console.error('Failed to parse OpenAI JSON response:', error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to parse generated checklist' 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate checklist structure
    if (!generatedChecklist.checklist || !Array.isArray(generatedChecklist.checklist)) {
      console.error('Invalid checklist structure:', generatedChecklist)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Generated checklist has invalid structure' 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate each checklist item
    const validatedChecklist = generatedChecklist.checklist.filter((item: any) => {
      return (
        item.id && 
        item.category && 
        item.requirement && 
        item.description && 
        ['high', 'medium', 'low'].includes(item.priority) &&
        typeof item.verifiable === 'boolean'
      )
    })

    if (validatedChecklist.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No valid checklist items generated' 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Prepare successful response
    const response: ChecklistResponse = {
      success: true,
      checklist: validatedChecklist,
      totalItems: validatedChecklist.length,
      estimatedDuration: generatedChecklist.estimatedDuration || 'Not specified'
    }

    console.log(`Successfully generated checklist with ${validatedChecklist.length} items`)

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Unexpected error in generateChecklist function:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'An unexpected error occurred while generating the checklist' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})