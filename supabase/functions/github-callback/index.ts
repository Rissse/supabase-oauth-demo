import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string;
  email: string;
}

interface Commit {
  repo: string;
  message: string;
  date: string;
  url: string;
}

async function exchangeCodeForToken(code: string): Promise<string> {
  const clientId = Deno.env.get("GITHUB_CLIENT_ID");
  const clientSecret = Deno.env.get("GITHUB_CLIENT_SECRET");

  console.log("DEBUG: CLIENT_ID", clientId);
  console.log("DEBUG: CLIENT_SECRET is present?", !!clientSecret);

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      code,
    }),
  });

  const data = await response.json();
  console.log("DEBUG: GitHub token response", JSON.stringify(data));

  if (!response.ok || !data.access_token) {
    throw new Error("GitHub token exchange failed: " + JSON.stringify(data));
  }

  return data.access_token;
}

async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch GitHub user');
  }

  const user = await response.json();
  console.log("DEBUG: userData", JSON.stringify(user));
  return user;
}

async function fetchUserCommits(accessToken: string, username: string): Promise<Array<{repo: string, message: string, date: string, url: string}>> {
  // Fetch the user's public events (push events contain commits)
  const eventsRes = await fetch(`https://api.github.com/users/${username}/events/public`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });
  if (!eventsRes.ok) {
    throw new Error('Failed to fetch user events');
  }
  const events = await eventsRes.json();
  console.log("Fetched events:", JSON.stringify(events, null, 2));
  // Filter for PushEvent and extract commit messages and dates
  const commits: Array<{repo: string, message: string, date: string, url: string}> = [];
  for (const event of events) {
    if (event.type === 'PushEvent' && event.payload?.commits) {
      for (const commit of event.payload.commits) {
        if (commit && commit.message && commit.sha) {
          commits.push({
            repo: event.repo.name,
            message: commit.message,
            date: event.created_at,
            url: `https://github.com/${event.repo.name}/commit/${commit.sha}`,
          });
        }
      }
    }
  }
  console.log("Filtered commits:", JSON.stringify(commits, null, 2));
  return commits;
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');

    if (!code) {
      return new Response(
        JSON.stringify({ error: 'No code provided' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const accessToken = await exchangeCodeForToken(code);
    const userData = await fetchGitHubUser(accessToken);

    let commits: Array<{repo: string, message: string, date: string, url: string}> = [];
    try {
      commits = await fetchUserCommits(accessToken, userData.login);
    } catch (e) {
      console.error('Failed to fetch commits:', e);
    }

    // Store user and commits in Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabase.from('github_users').upsert({
      id: userData.id,
      login: userData.login,
      avatar_url: userData.avatar_url,
      created_at: new Date().toISOString(),
    });

    for (const commit of commits) {
      await supabase.from('github_commits').insert({
        user_id: userData.id,
        repo: commit.repo,
        message: commit.message,
        date: commit.date,
        url: commit.url,
      });
    }

    return new Response(
      JSON.stringify({ user: userData, recent_commits: commits }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error("OAuth Error:", error);
  
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
