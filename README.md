# Trip Balance

Shared travel expense & settlement tracker, built on TanStack Start (React 19 + Vite 7) with a Supabase backend.

## Local development

```bash
bun install
bun run dev
```

The dev server runs on `http://localhost:8080` (Lovable sandbox default) or whatever Vite picks locally.

## Production build (Node, for self-hosting)

```bash
bun install
bun run build
node .output/server/index.mjs
```

`vite build` runs the Nitro `node-server` preset and emits a standalone Node bundle in `.output/`.
The server listens on `PORT` (default `3000`) and `HOST` (default `0.0.0.0`).

## Docker

### Build the image

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
  --build-arg VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID \
  -t trip-balance-app:latest .
```

### Run with docker compose

```bash
cp .env.example .env   # then fill in values
docker compose up -d --build
```

The container exposes the app on host port **3000** (internal container port **3000**). Put nginx / Caddy / Hostinger's reverse proxy in front for TLS.

### Logs / restart

```bash
docker compose logs -f app
docker compose restart app
docker compose down
```

## Required environment variables

`VITE_*` values are inlined into the client bundle at build time; the unprefixed values are read at runtime by SSR / server functions. In this project they point at the same Supabase project.

| Variable                          | When used     | Required | Notes |
| --------------------------------- | ------------- | -------- | ----- |
| `VITE_SUPABASE_URL`               | build (client) | yes      | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY`   | build (client) | yes      | Supabase anon / publishable key |
| `VITE_SUPABASE_PROJECT_ID`        | build (client) | yes      | Supabase project ref |
| `SUPABASE_URL`                    | runtime (server) | yes    | Same value as `VITE_SUPABASE_URL` |
| `SUPABASE_PUBLISHABLE_KEY`        | runtime (server) | yes    | Same value as `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `SUPABASE_PROJECT_ID`             | runtime (server) | yes    | Same value as `VITE_SUPABASE_PROJECT_ID` |
| `PORT`                            | runtime          | no       | Defaults to `3000` |
| `HOST`                            | runtime          | no       | Defaults to `0.0.0.0` |
| `NODE_ENV`                        | runtime          | no       | `production` in Docker |

See `.env.example` for a copy-pasteable template.

## Hostinger VPS deployment notes

1. Install Docker + Docker Compose plugin on the VPS (`apt install docker.io docker-compose-plugin` or use Hostinger's Docker template).
2. `git clone` this repo (after connecting it to GitHub from the Lovable UI) onto the VPS.
3. `cp .env.example .env` and fill in the Supabase values.
4. `docker compose up -d --build`.
5. Point your reverse proxy (nginx / Caddy / Traefik / Hostinger's built-in) at `http://127.0.0.1:3000` and terminate TLS there.
6. To deploy a new build: `git pull && docker compose up -d --build`.

### Notes / caveats

- **Supabase**: This deployment still uses the Lovable Cloud Supabase project — schema, auth, RLS, and email continue to be managed there. Self-hosting only moves the frontend/SSR layer onto your VPS.
- **Google sign-in**: Uses Supabase's direct Google OAuth (no Lovable broker, no `LOVABLE_API_KEY` needed). You must configure the Google provider in Supabase Auth and add your VPS URL to the redirect allow list — see below.
- **Password reset & OAuth redirect emails** link back to whatever Site URL / Redirect URLs are configured in Supabase Auth — update those to your VPS domain once it is live, otherwise links will land on the Lovable preview/published URL.

### Supabase Auth configuration for `https://trip-balance.clickcraft.tech`

In Supabase Auth settings (Authentication → URL Configuration):

- **Site URL**: `https://trip-balance.clickcraft.tech`
- **Additional Redirect URLs** (one per line):
  - `https://trip-balance.clickcraft.tech/**`
  - `https://trip-balance.clickcraft.tech/auth`
  - `https://trip-balance.clickcraft.tech/reset-password`
  - (keep any existing Lovable preview / published URLs you still use)

In Authentication → Providers → Google:

1. Enable the Google provider.
2. Create an OAuth 2.0 Client ID in Google Cloud Console (type: Web application).
3. Under **Authorized redirect URIs** in Google Cloud, add the Supabase callback URL shown on the Supabase Google provider page — it looks like:
   `https://<your-supabase-ref>.supabase.co/auth/v1/callback`
4. Paste the Google **Client ID** and **Client Secret** into the Supabase Google provider settings and save.

Google returns to Supabase's `/auth/v1/callback`, Supabase then redirects to `https://trip-balance.clickcraft.tech/auth`, and the Supabase JS client picks up the session from the URL automatically.