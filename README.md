# Ostras — AI Social Content Studio

Ostras helps a brand turn a niche and a few content themes into a steady social publishing rhythm. Set up the brand once, generate captions and artwork, review or edit each draft, and schedule it for Instagram. Automatic mode fills the upcoming queue from the topics you choose.

## What it includes

- A responsive Next.js workspace for the content overview, post library, weekly calendar, and brand settings.
- A Node.js and Express API with MongoDB persistence, workspace accounts, secure sessions, validation, and request limits.
- AI caption and hashtag generation, with optional original square artwork.
- Manual draft editing, scheduling, retry after a publishing error, and immediate publishing.
- A MongoDB-backed scheduler that prepares the next three posts and publishes due posts.
- Instagram professional-account login, encrypted long-lived access tokens, and image publishing through the Instagram API.
- Automatic publishing starts off. The owner must connect Instagram, add topics, set the brand rhythm, and turn it on.

## Stack

| Area | Technology |
| --- | --- |
| Frontend | Next.js App Router, React, JavaScript, custom responsive CSS |
| Backend | Node.js, Express, JavaScript |
| Database | MongoDB with Mongoose |
| Authentication | JWT in an HTTP-only cookie, bcrypt password hashing |
| AI | OpenAI text and image APIs |
| Instagram | Instagram API with Instagram Login |

## Local setup

Requirements: Node.js 20.9+, npm, and a running MongoDB database (local MongoDB or MongoDB Atlas).

```bash
npm install
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
npm run dev
```

The web app runs at `http://localhost:3000`; the API runs at `http://localhost:4000`. The API health check is `GET http://localhost:4000/api/health`.

Before using the AI or Instagram features, set the API environment values in `.env`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/ostras
JWT_SECRET=use-a-long-random-private-value
TOKEN_ENCRYPTION_KEY=64-hex-characters-from-openssl-rand-hex-32
OPENAI_API_KEY=your-openai-api-key
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret
META_REDIRECT_URI=http://localhost:4000/api/integrations/instagram/callback
```

Generate an encryption key with `openssl rand -hex 32`. Never commit `.env`, real API keys, or access tokens.

## Instagram setup

Instagram publishing requires an Instagram Business or Creator account and a Meta developer app configured for Instagram Login. Add the callback URL from `META_REDIRECT_URI` to the Meta app, enable the `instagram_business_basic` and `instagram_business_content_publish` permissions, and complete Meta's app review requirements before connecting accounts outside the app's development roles.

Instagram fetches the image from a public HTTPS URL when publishing. Set `API_PUBLIC_URL` to a publicly reachable HTTPS API host in a deployed environment. The included local upload directory is for development; use durable object storage/CDN for a production deployment so generated artwork remains available to Instagram.

## Automatic publishing

Automatic mode is disabled by default. After connecting Instagram:

1. Add one or more topics to the brand settings.
2. Choose the number of posts per week, timezone, and preferred time.
3. Choose whether the queue should include generated images.
4. Save and turn on automatic publishing.

The API prepares up to three scheduled posts ahead from those topics. The MongoDB-backed worker checks for due posts every 30 seconds. Failed posts remain visible in the library with an error message so they can be reviewed and retried. Keep one scheduler process active per deployment; if running multiple API replicas, move the scheduler into a dedicated worker or add a distributed lease before scaling horizontally.

## Project structure

```text
apps/
  api/                 Express API, MongoDB models, AI, Instagram, scheduler
  web/                 Next.js app and responsive workspace UI
legacy/
  supabase-functions/  original Ostras Edge Functions, retained for migration reference
```

## Main API routes

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create an account and brand workspace |
| POST | `/api/auth/login` | Start a secure session |
| GET | `/api/auth/me` | Load current user and brand |
| GET, PATCH | `/api/brand` | Read or update brand voice and automation settings |
| GET | `/api/dashboard` | Read post counts, recent activity, and upcoming content |
| GET, POST | `/api/posts` | List or create posts |
| POST | `/api/posts/generate` | Generate an AI caption and optional artwork |
| POST | `/api/posts/:postId/schedule` | Schedule a draft |
| POST | `/api/posts/:postId/publish` | Publish a reviewed post now |
| GET | `/api/integrations/instagram/connect` | Start Instagram Login |
| DELETE | `/api/integrations/instagram` | Disconnect the Instagram account |

## Deployment notes

- Deploy `apps/web` and `apps/api` with HTTPS. Set `WEB_ORIGIN`, `API_PUBLIC_URL`, `NEXT_PUBLIC_API_URL`, `MONGODB_URI`, and all required secrets for the chosen hosts.
- Configure CORS to the exact web origin; avoid wildcard origins when cookie credentials are enabled.
- Use a private MongoDB cluster, a strong JWT secret, and a 32-byte encryption key stored in the host's secret manager.
- Use durable object storage for generated artwork, set upload size and retention policies, and back up MongoDB.
- Configure the Meta app's privacy policy, deletion callback, and data deletion instructions before requesting production access.
