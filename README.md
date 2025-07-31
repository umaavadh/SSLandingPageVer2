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

### Edge Functions

The project includes Supabase Edge Functions for AI-powered features:

- `generateChecklist`: Creates detailed project checklists using GPT-4o

**IMPORTANT**: Edge Functions require environment variables to be set as Supabase secrets, not local `.env` files.

**NOTE**: In WebContainer environments (like this demo), the OpenAI integration uses mock data for demonstration purposes. For production deployment with real OpenAI integration, follow the setup instructions below.

#### Setting Up Edge Function Secrets

To configure the OpenAI API key for Edge Functions, you need to use the Supabase CLI:

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link your project**:
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. **Set the OpenAI API key as a secret**:
   ```bash
   supabase secrets set OPENAI_API_KEY="your_openai_api_key_here"
   ```

5. **Deploy the Edge Function**:
   ```bash
   supabase functions deploy generate-checklist
   ```

**Note**: In WebContainer environments (like this one), you cannot use the Supabase CLI. For production deployment, you'll need to run these commands in a local environment or CI/CD pipeline.

#### Alternative: Supabase Dashboard Method

You can also set secrets through the Supabase Dashboard:
1. Go to your Supabase project dashboard
2. Navigate to Edge Functions → Settings
3. Add `OPENAI_API_KEY` as an environment variable
4. Redeploy your functions

### Running the Application

After setting up the environment variables, you can start the development server:

```bash
npm run dev
```