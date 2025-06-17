# GitHub OAuth Callback Supabase Edge Function

This project contains a Supabase Edge Function that handles GitHub OAuth. It exchanges the authorization code for an access token, fetches the user's profile and recent commits, and stores them in a Supabase database.

## Features

- Exchanges GitHub OAuth code for an access token.
- Fetches the GitHub user profile.
- Retrieves the user's recent commits.
- Stores user and commit data in Supabase.

## Prerequisites

- A Supabase project with Edge Functions enabled.
- A GitHub OAuth app with a client ID and client secret.
- Supabase CLI installed (or use `npx`).

## Environment Variables

Set the following environment variables in your Supabase project:

- `GITHUB_CLIENT_ID`: Your GitHub OAuth app client ID.
- `GITHUB_CLIENT_SECRET`: Your GitHub OAuth app client secret.
- `SUPABASE_URL`: Your Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key.

## Database Setup

Create the following tables in your Supabase database:

```sql
-- github_users
create table github_users (
  id bigint primary key,
  login text,
  avatar_url text,
  created_at timestamptz
);

-- github_commits
create table github_commits (
  id bigserial primary key,
  user_id bigint references github_users(id),
  repo text,
  message text,
  date timestamptz,
  url text
);
```

## Deployment

1. Deploy the function using the Supabase CLI:

   ```bash
   supabase functions deploy github-callback
   ```

   Or use `npx`:

   ```bash
   npx supabase functions deploy github-callback
   ```

2. The function will be available at:

   ```
   https://<your-project-ref>.supabase.co/functions/v1/github-callback
   ```

## Usage

1. Redirect users to the GitHub OAuth authorization URL with your client ID and redirect URI.
2. After authorization, GitHub will redirect to your callback URL with a `code` parameter.
3. The function will exchange the code for an access token, fetch the user's profile and commits, and store them in Supabase.

## Debugging

- Check the Supabase function logs for any errors or console output.
- Ensure your GitHub OAuth app is configured correctly and the environment variables are set.

## License

MIT 