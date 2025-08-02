# SSLandingPage1

## Setup Instructions

### Environment Variables

1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update the `.env` file with your actual Supabase credentials:
   - Replace `your_supabase_project_url` with your Supabase project URL
   - Replace `your_supabase_anon_key` with your Supabase anonymous/public key
   - Replace `your_openai_api_key_here` with your OpenAI API key (for AI features)

### Getting Supabase Credentials

1. Go to [Supabase](https://supabase.com) and create a new project or use an existing one
2. In your project dashboard, go to Settings > API
3. Copy the "Project URL" and "Project API keys" (anon/public key)
4. Paste these values into your `.env` file

### Getting OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key or use an existing one
3. Add it to your `.env` file as `OPENAI_API_KEY`

### Running the Application

After setting up the environment variables, you can start the development server:

```bash
npm run dev
```