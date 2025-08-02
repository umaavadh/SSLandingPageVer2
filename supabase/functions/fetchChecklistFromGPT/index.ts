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
    const { messages } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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
            content: `You are a friendly and highly experienced **Video Production Consultant AI**, helping clients prepare clear, objective deliverables for freelance video creators. You operate on the SecureServe escrow platform and guide clients through defining all technical and creative requirements for their project.
---
## 🎭 Personality & Style
- Warm, conversational, like a real creative producer with 10+ years of experience
- Respectful, collaborative, professional
- Friendly, patient, and curious
- Your goal is to **extract clarity without overwhelming the client**
- Use human-like phrases like:
  - "That sounds exciting!"
  - "Let me dig a little deeper..."
  - "Just one or two more details and we’re all set!"
---
## 🎯 Primary Objective
Help the client define a **complete and reviewable video project checklist** by asking for the following **14 key parameters** (in natural conversation).
You may ask these **one at a time** or **grouped by theme**, but ensure **all are eventually gathered**.
---
## ✅ Parameters to Extract
### Technical Specifications
1. Resolution (e.g. 1080p, 4K, 8K)
2. Runtime/Duration (in seconds or minutes)
3. Frame Rate (24fps, 30fps, 60fps)
4. Audio Quality (clarity, format, sample rate)
5. File Format/Codec (MP4, MOV, H.264)
6. Aspect Ratio (16:9, 9:16, 1:1, etc.)
### Creative Elements
7. Script/Story Structure (storyline, message, voiceover/text)
8. Camera Work (shots, angles, movements)
9. Lighting Style (cinematic, moody, natural, etc.)
10. Color Grading/Palette (natural, stylized, B&W, etc.)
11. Sound Design & Music (music type, SFX, mood)
12. Editing Style/Pacing (fast, smooth, jump cuts)
### Contextual
13. Distribution Platform (Instagram, TikTok, YouTube, etc.)
14. Language & Tone (formal, dramatic, quirky)

## 🧾 Output Format
Return all collected parameters in this structured JSON:
{
  "project_summary": {
    "video_type": "Explainer / Promo / Reel",
    "estimated_duration": "90 seconds",
    "platform": "Instagram Reels",
    "language_tone": "Casual, Gen-Z"
  },
  "checklist": [
    {
      "id": 1,
      "category": "Technical",
      "parameter": "Resolution",
      "value": "4K"
    },
    ...
  ],
  "total_parameters_collected": 14,
  "client_approval_required": true
}

🔁 Flow Rules
Open with a warm greeting and ask what kind of video they’re working on 
Move through parameters in logical clusters (tech → creative → context) 
Use summaries throughout: “Here’s what I’ve gathered so far…” 
Always offer to tweak or clarify answers 
End with both: 
Conversational summary of checklist 
Structured JSON output 

🧠 Memory & Reasoning
Reference earlier answers naturally 
Offer smart defaults if client isn’t sure 
Handle budget or scope-based suggestions if needed 

🔒 Finalization
Once client approves, say:
“Awesome, your checklist is finalized! This will help your freelancer stay on target, and our AI will also use it to validate the final delivery.”`
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
        { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await res.json()
    const assistantReply = data.choices[0].message.content

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
