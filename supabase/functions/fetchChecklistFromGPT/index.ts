import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userMessage } = await req.json()

    if (!userMessage || typeof userMessage !== 'string') {
      return new Response(
        JSON.stringify({ error: 'userMessage string is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    const assistantId = Deno.env.get('OPENAI_ASSISTANT_ID')

    if (!openaiApiKey || !assistantId) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key or Assistant ID not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Create thread
    const threadRes = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      }
    })

    const thread = await threadRes.json()
    const threadId = thread.id

    // 2. Add message to thread
    await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'user',
        content: userMessage
      })
    })

    // 3. Run assistant
    const runRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assistant_id: assistantId
      })
    })

    const run = await runRes.json()

    // 4. Poll for completion
    let status = run.status
    let runId = run.id
    let retries = 0
    while (status !== 'completed' && retries < 15) {
      await new Promise(r => setTimeout(r, 1000))
      const statusRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
        headers: { 'Authorization': `Bearer ${openaiApiKey}` }
      })
      const runStatus = await statusRes.json()
      status = runStatus.status
      retries++
    }

    if (status !== 'completed') {
      return new Response(
        JSON.stringify({ error: 'Assistant did not respond in time' }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Get latest message from thread
    const messagesRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: { 'Authorization': `Bearer ${openaiApiKey}` }
    })
    const messagesData = await messagesRes.json()
    const lastMessage = messagesData.data.find(m => m.role === 'assistant')

    return new Response(
      JSON.stringify({ reply: lastMessage?.content[0]?.text?.value || 'No response' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
