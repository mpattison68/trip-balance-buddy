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
| `LOVABLE_API_KEY`                 | runtime (server) | only if Google sign-in is used | Google OAuth currently goes through the Lovable broker. Copy from Lovable → Project Settings → Secrets. |
| `PORT`                            | runtime          | no       | Defaults to `3000` |
| `HOST`                            | runtime          | no       | Defaults to `0.0.0.0` |
| `NODE_ENV`                        | runtime          | no       | `production` in Docker |

See `.env.example` for a copy-pasteable template.

## Hostinger VPS deployment notes

1. Install Docker + Docker Compose plugin on the VPS (`apt install docker.io docker-compose-plugin` or use Hostinger's Docker template).
2. `git clone` this repo (after connecting it to GitHub from the Lovable UI) onto the VPS.
3. `cp .env.example .env` and fill in the Supabase values (and `LOVABLE_API_KEY` if you want Google sign-in to keep working).
4. `docker compose up -d --build`.
5. Point your reverse proxy (nginx / Caddy / Traefik / Hostinger's built-in) at `http://127.0.0.1:3000` and terminate TLS there.
6. To deploy a new build: `git pull && docker compose up -d --build`.

### Notes / caveats

- **Supabase**: This deployment still uses the Lovable Cloud Supabase project — schema, auth, RLS, and email continue to be managed there. Self-hosting only moves the frontend/SSR layer onto your VPS.
- **Google sign-in**: Goes through the Lovable OAuth broker, which requires `LOVABLE_API_KEY` at runtime. Email/password and password reset work without it.
- **Password reset emails** still link back to whatever site URL is configured in Supabase Auth — update that to your VPS domain once it is live, otherwise the reset link will land on the Lovable preview/published URL.