# Supabase Setup Guide

This guide walks through setting up Supabase for Arete cloud sync.

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Create a new project
3. Note down:
   - **Project URL**: `https://your-project.supabase.co`
   - **Anon Key**: Found in Settings → API → Project API keys

## 2. Run Migrations

Apply migrations in order via the SQL Editor:

```bash
# In Supabase Dashboard → SQL Editor
# Run each file in migrations/ folder in order:
# 1. 00001_create_profiles.sql
# 2. 00002_create_identities.sql
# 3. 00003_create_context_events.sql
# 4. 00004_enable_realtime.sql
```

Or use Supabase CLI:

```bash
supabase db push
```

## 3. Configure Google OAuth

### In Google Cloud Console:

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable "Google+ API" (for user profile access)
3. Go to Credentials → Create OAuth 2.0 Client ID
4. Set Authorized JavaScript origins:
   - `https://your-project.supabase.co`
5. Set Authorized redirect URIs:
   - `https://your-project.supabase.co/auth/v1/callback`
6. Note the **Client ID** and **Client Secret**

### In Supabase Dashboard:

1. Go to Authentication → Providers → Google
2. Enable Google provider
3. Enter Client ID and Client Secret from Google Cloud

### For Chrome Extension:

Add to `manifest.json`:

```json
{
  "permissions": ["identity"],
  "oauth2": {
    "client_id": "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
    "scopes": ["openid", "email", "profile"]
  }
}
```

## 4. Environment Variables

Create `.env` file (gitignored):

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
```

## 5. Verify Setup

Run the test suite:

```bash
npm test -- supabase
```

Check tables exist:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';
-- Should show: profiles, identities, context_events
```

Check RLS is enabled:

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public';
-- All should show 't' for rowsecurity
```

## Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profile data (auto-created on signup) |
| `identities` | User identity JSON (one per user) |
| `context_events` | Browsing context, selections, insights |

## Security

- **Row Level Security (RLS)** ensures users can only access their own data
- **Anon key** is safe to expose in client code
- All data is isolated per user via `auth.uid()` policies

## Realtime

Enabled for `identities` and `context_events` tables. Changes sync automatically across:
- Chrome extension
- CLI
- MCP server
