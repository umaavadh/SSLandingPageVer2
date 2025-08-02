import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { messages } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Call OpenAI API
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an AI project assistant for SecureServe, helping clients create detailed project checklists for freelance work. Your goal is to gather 14 key parameters through natural conversation:

1. Project type/category
2. Target duration/length
3. Target audience
4. Budget range
5. Style preferences
6. Brand assets availability
7. Timeline/deadline
8. Primary goal/objective
9. Usage platforms
10. Technical requirements (resolution, format, etc.)
11. Multiple versions needed
12. Content/script availability
13. Revision rounds included
14. Delivery format preferences

Ask follow-up questions naturally and conversationally. Once you have gathered most parameters, let the user know they can generate the final checklist. Be helpful, professional, and focused on video production projects initially.`
          },
          ...messages
        ],
        temperature: 1,
        top_p: 1,
        max_tokens: 2048,
        presence_penalty: 0,
        frequency_penalty: 0
      })
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('OpenAI API error:', res.status, err)
      return new Response(
        JSON.stringify({ error: `OpenAI API error: ${res.status}` }),
        { 
          status: res.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const data = await res.json()
    const assistantReply = data.choices[0].message.content

    // Simple parameter extraction logic
    const parameterKeywords = [
      'video', 'duration', 'audience', 'budget', 'style', 'brand', 'timeline', 
      'goal', 'platform', 'resolution', 'format', 'version', 'script', 'revision'
    ]
    
    const messageText = assistantReply.toLowerCase()
    const detectedParams = parameterKeywords.filter(keyword => 
      messageText.includes(keyword) || messages.some(msg => 
        msg.content.toLowerCase().includes(keyword)
      )
    ).length

    return new Response(
      JSON.stringify({ 
        reply: assistantReply,
        detectedParameters: Math.min(detectedParams, 14)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})