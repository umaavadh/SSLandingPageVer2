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
      
      // TEMPORARY WORKAROUND: Return mock conversational response for WebContainer
      console.log('Using mock conversational response for demonstration purposes')
      
      const conversationHistory = requestData.conversationHistory || []
      const isFirstMessage = conversationHistory.length === 0
      
      if (isFirstMessage) {
        const mockResponse = {
          success: true,
          isComplete: false,
          response: "Great! I'd love to help you create a comprehensive video production checklist. I can see you want to create a video project, and I have a few questions to make sure we cover everything you need.",
          followUpQuestions: [
            "What's the target duration for your video? (30 seconds, 1 minute, 2-3 minutes, etc.)",
            "Who is your target audience for this video?",
            "What platforms will you be publishing this on? (YouTube, Instagram, website, etc.)"
          ],
          conversationHistory: [
            {
              role: 'user',
              content: requestData.description,
              timestamp: new Date().toISOString()
            },
            {
              role: 'assistant', 
              content: "Great! I'd love to help you create a comprehensive video production checklist. I can see you want to create a video project, and I have a few questions to make sure we cover everything you need.",
              timestamp: new Date().toISOString()
            }
          ]
        }
        
        return new Response(
          JSON.stringify(mockResponse),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      } else if (requestData.generateFinal || conversationHistory.length >= 6) {
        // Generate final checklist after some conversation
        const mockChecklist = {
          success: true,
          isComplete: true,
          checklist: [
            {
              id: "tech_001",
              category: "Technical",
              requirement: "1080p HD Resolution",
              description: "Video must be rendered in 1920x1080 resolution with high quality encoding",
              priority: "high",
              verifiable: true
            },
            {
              id: "tech_002", 
              category: "Technical",
              requirement: "MP4 Format",
              description: "Final video must be delivered in MP4 format with H.264 codec",
              priority: "high",
              verifiable: true
            },
            {
              id: "creative_001",
              category: "Creative",
              requirement: "Brand Guidelines Compliance",
              description: "Video must follow company brand guidelines including colors, fonts, and logo placement",
              priority: "medium",
              verifiable: true
            },
            {
              id: "creative_002",
              category: "Creative", 
              requirement: "Professional Transitions",
              description: "Use smooth, professional transitions between scenes that match the video style",
              priority: "medium",
              verifiable: true
            },
            {
              id: "content_001",
              category: "Content",
              requirement: "Target Duration Compliance",
              description: "Video must meet the specified duration requirements with proper pacing",
              priority: "high",
              verifiable: true
            },
            {
              id: "content_002",
              category: "Content",
              requirement: "Clear Call-to-Action",
              description: "Include clear, compelling call-to-action that aligns with project goals",
              priority: "high",
              verifiable: true
            },
            {
              id: "content_003",
              category: "Content",
              requirement: "Target Audience Alignment",
              description: "Content and messaging must resonate with the specified target audience",
              priority: "high",
              verifiable: false
            },
            {
              id: "delivery_001",
              category: "Delivery",
              requirement: "Platform Optimization",
              description: "Video optimized for specified platforms with appropriate aspect ratios and specifications",
              priority: "medium",
              verifiable: true
            },
            {
              id: "delivery_002",
              category: "Delivery",
              requirement: "Multiple Format Delivery",
              description: "Provide video in multiple formats as requested (web, social media, etc.)",
              priority: "medium",
              verifiable: true
            },
            {
              id: "quality_001",
              category: "Quality",
              requirement: "Audio Quality Standards",
              description: "Clear audio with no background noise, properly mixed and mastered",
              priority: "high",
              verifiable: true
            },
            {
              id: "quality_002",
              category: "Quality",
              requirement: "Color Correction",
              description: "Professional color grading and correction applied throughout the video",
              priority: "medium",
              verifiable: true
            },
            {
              id: "quality_003",
              category: "Quality",
              requirement: "Final Quality Review",
              description: "Comprehensive quality check for visual and audio consistency",
              priority: "high",
              verifiable: false
            }
          ],
          totalItems: 12,
          estimatedDuration: "5-7 days",
          conversationHistory: [
            ...conversationHistory,
            {
              role: 'user',
              content: requestData.description,
              timestamp: new Date().toISOString()
            },
            {
              role: 'assistant',
              content: "Perfect! Based on our conversation, I now have enough information to create your comprehensive video production checklist. Here's your customized checklist with 12 key deliverables.",
              timestamp: new Date().toISOString()
            }
          ]
        }
        
        return new Response(
          JSON.stringify(mockChecklist),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      } else {
        // Continue conversation
        const mockContinuation = {
          success: true,
          isComplete: false,
          response: "Thanks for that information! That helps me understand your project better. I have a few more questions to ensure we create the perfect checklist for your needs.",
          followUpQuestions: [
            "What's your budget range for this video project?",
            "Do you have existing brand guidelines or specific colors/fonts to follow?",
            "What's your ideal timeline for completion?"
          ],
          conversationHistory: [
            ...conversationHistory,
            {
              role: 'user',
              content: requestData.description,
              timestamp: new Date().toISOString()
            },
            {
              role: 'assistant',
              content: "Thanks for that information! That helps me understand your project better. I have a few more questions to ensure we create the perfect checklist for your needs.",
              timestamp: new Date().toISOString()
            }
          ]
        }
        
        return new Response(
          JSON.stringify(mockContinuation),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
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