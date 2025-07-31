/*
  # Generate Checklist Function - Conversational Version with Gemini

  This function acts as a human consultant, asking follow-up questions
  to gather all necessary information before generating a comprehensive checklist.
  Now powered by Google's Gemini AI.

  ## Input
  - `description`: Initial project description or follow-up response
  - `conversationHistory`: Array of previous messages (optional)
  - `generateFinal`: Boolean to force final checklist generation (optional)

  ## Output
  - Conversational response with follow-up questions OR final structured checklist
*/

import { corsHeaders } from '../_shared/cors.ts'

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface ChecklistRequest {
  description: string
  conversationHistory?: ConversationMessage[]
  generateFinal?: boolean
}

interface ChecklistItem {
  id: string
  category: string
  requirement: string
  description: string
  priority: 'high' | 'medium' | 'low'
  verifiable: boolean
}

interface ConversationalResponse {
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

const CONSULTANT_SYSTEM_PROMPT = `You are an expert video production consultant. Your job is to gather comprehensive information about a video project through natural conversation before creating a detailed checklist.

CONVERSATION GOALS:
You need to gather information about these 14 key parameters:
1. Video duration/length
2. Video resolution/quality (4K, 1080p, 720p)
3. Video format/codec (MP4, MOV, etc.)
4. Target audience
5. Video style/tone (corporate, casual, dramatic, etc.)
6. Brand guidelines/colors/fonts
7. Audio requirements (music, voiceover, sound effects)
8. Delivery timeline/deadline
9. Distribution platforms (YouTube, social media, website)
10. Budget considerations
11. Specific scenes or shots needed
12. Text/graphics requirements
13. Revision expectations
14. File delivery format preferences

CONVERSATION STYLE:
- Use conversational language, not robotic
- Show enthusiasm and expertise
- Acknowledge what they've already told you
- Ask 2-3 follow-up questions at a time
- Be specific and practical in your questions

WHEN TO GENERATE CHECKLIST:
Only generate the final checklist when you have gathered information about at least 10 of the 14 parameters, or when the user explicitly asks for the checklist.

RESPONSE FORMAT:
For conversation: Return a JSON object with:
{
  "isComplete": false,
  "response": "Your conversational response here",
  "followUpQuestions": ["Question 1?", "Question 2?", "Question 3?"]
}

For final checklist: Return a JSON object with:
{
  "isComplete": true,
  "checklist": [...],
  "totalItems": number,
  "estimatedDuration": "X days"
}`

const CHECKLIST_GENERATION_PROMPT = `Based on our conversation, create a comprehensive video production checklist. 

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

Make the checklist comprehensive but practical, typically 12-20 items based on project complexity.`

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

    // Get Gemini API key from environment
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      console.error('Gemini API key not found in environment variables')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Gemini API key not configured. Please set GEMINI_API_KEY environment variable.' 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Build conversation context for Gemini
    let conversationContext = CONSULTANT_SYSTEM_PROMPT + "\n\n"

    // Add conversation history
    if (requestData.conversationHistory && requestData.conversationHistory.length > 0) {
      conversationContext += "Previous conversation:\n"
      requestData.conversationHistory.forEach(msg => {
        const role = msg.role === 'user' ? 'Human' : 'Assistant'
        conversationContext += `${role}: ${msg.content}\n`
      })
      conversationContext += "\n"
    }

    // Add current user message
    conversationContext += `Human: ${requestData.description.trim()}\n\n`

    // Determine if we should generate final checklist
    const shouldGenerateFinal = requestData.generateFinal || 
      (requestData.conversationHistory && requestData.conversationHistory.length >= 8)

    if (shouldGenerateFinal) {
      // Generate final checklist
      conversationContext += CHECKLIST_GENERATION_PROMPT + "\n\n"
      conversationContext += "Assistant: "
    } else {
      conversationContext += "Assistant: "
    }

    // Prepare Gemini request
    const geminiRequest = {
      contents: [
        {
          parts: [
            {
              text: conversationContext
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
        responseMimeType: "application/json"
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    }

    // Call Gemini API
    console.log('Calling Gemini API for conversational checklist generation...')
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(geminiRequest),
    })

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Gemini API error:', errorText)
      
      if (geminiResponse.status === 401) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Invalid Gemini API key' 
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      } else if (geminiResponse.status === 429) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Gemini API rate limit exceeded. Please try again later.' 
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
            error: 'Failed to generate response. Please try again.' 
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
    }

    const geminiData = await geminiResponse.json()
    
    if (!geminiData.candidates || !geminiData.candidates[0] || !geminiData.candidates[0].content || !geminiData.candidates[0].content.parts || !geminiData.candidates[0].content.parts[0]) {
      console.error('Invalid Gemini response structure:', geminiData)
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

    // Parse the AI response
    let aiResponse
    try {
      const responseText = geminiData.candidates[0].content.parts[0].text
      aiResponse = JSON.parse(responseText)
    } catch (error) {
      console.error('Failed to parse Gemini JSON response:', error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to parse AI response' 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Update conversation history
    const updatedHistory = [
      ...(requestData.conversationHistory || []),
      {
        role: 'user',
        content: requestData.description.trim(),
        timestamp: new Date().toISOString()
      },
      {
        role: 'assistant',
        content: aiResponse.response || 'Generated checklist',
        timestamp: new Date().toISOString()
      }
    ]

    // Prepare response
    const response: ConversationalResponse = {
      success: true,
      isComplete: aiResponse.isComplete || shouldGenerateFinal,
      conversationHistory: updatedHistory,
      ...aiResponse
    }

    console.log(`Successfully generated ${response.isComplete ? 'final checklist' : 'conversational response'} using Gemini`)

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
        error: 'An unexpected error occurred while processing your request' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})