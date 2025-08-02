import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiApiKey = Deno.env.get('SecureServe_Wizard_OpenAI_Key');

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'SecureServe_Wizard_OpenAI_Key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call OpenAI Chat Completions API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a helpful project management assistant for SecureServe, a freelance platform. Your job is to help clients define their video production projects by asking targeted questions to gather 14 key parameters.

Key parameters to collect:
1. Project type/category
2. Target audience
3. Video duration/length
4. Video style/format
5. Budget range
6. Timeline/deadline
7. Deliverables format
8. Revision rounds
9. Script requirements
10. Voiceover needs
11. Music/audio requirements
12. Branding guidelines
13. Distribution channels
14. Success metrics

Guidelines:
- Ask 1-2 focused questions at a time
- Be conversational and friendly
- Provide examples when helpful
- Once you have all 14 parameters, let the user know they can generate their final checklist
- Keep responses concise but informative

Always end your response with a JSON object indicating how many parameters you've collected so far:
\`\`\`json
{"parameters_collected": X}
\`\`\``
          },
          ...messages
        ],
        temperature: 1,
        top_p: 1,
        max_tokens: 2048,
        presence_penalty: 0,
        frequency_penalty: 0
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const assistantReply = data.choices[0].message.content;

    // Extract parameter count from the response
    let parametersCollected = 0;
    try {
      const jsonMatch = assistantReply.match(/```json\s*\n(.*?)\n```/s);
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[1]);
        parametersCollected = jsonData.parameters_collected || 0;
      }
    } catch (e) {
      // If parsing fails, default to 0
      parametersCollected = 0;
    }

    return new Response(
      JSON.stringify({ 
        reply: assistantReply,
        parametersCollected: parametersCollected
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
