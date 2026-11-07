# Ostras — Social Content Studio

Ostras helps a brand plan, create, review, schedule, and publish Instagram content. The repository is organized as two independent applications: a Next.js frontend and a Node.js/Express backend. MongoDB stores users, brand settings, social connections, and posts. The existing automatic content queue and publishing scheduler remain available, and n8n can receive signed events to trigger additional workflows.

## Features

- Responsive Next.js App Router dashboard with overview, content studio, post library, publishing calendar, and brand settings.
- Node.js and Express REST API with MongoDB/Mongoose, workspace accounts, validation, secure HTTP-only sessions, rate limits, and health endpoint.
- AI caption, hashtags, and optional image generation through OpenAI.
- Draft editing, scheduling, retry after publish errors, and immediate Instagram publishing.
- MongoDB-backed scheduler that fills the upcoming queue and publishes due posts. Automatic publishing is off until the owner enables it.
- Instagram Professional account connection through Meta OAuth with encrypted long-lived access tokens.
- n8n webhook integration for `post.created`, `post.scheduled`, `post.published`, and `post.failed` events. Events are HMAC-signed; a test event is available from brand settings.
- Original Supabase Edge Functions retained under `legacy/` for migration reference.

## Technology

| Area | Stack |
| --- | --- |
| Frontend | Next.js App Router, React, JavaScript, responsive CSS |
| Backend | Node.js, Express, JavaScript |
| Database | MongoDB, Mongoose |
| Authentication | JWT in HTTP-only cookie, bcrypt password hashing |
| AI | OpenAI text and image APIs |
| Publishing | Instagram API with Instagram Login |
| Workflow automation | n8n webhook with HMAC-SHA256 signatures |

## Repository layout

```text
frontend/       Next.js application
backend/        Express API, MongoDB models, AI and integrations
n8n/            Importable n8n workflow starter
legacy/         Original Supabase functions retained for reference
```

## Local setup

Requirements: Node.js 20.9+, npm, and MongoDB (local installation or MongoDB Atlas).

```bash
npm install
cp .env.example .env
cp frontend/.env.example frontend/.env.local
npm run dev
```

The frontend starts at `http://localhost:3000`; the API starts at `http://localhost:4000`. Check API availability at `http://localhost:4000/api/health`.

Configure backend values in the root `.env`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/ostras
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-characters
TOKEN_ENCRYPTION_KEY=64-hex-characters-from-openssl-rand-hex-32
OPENAI_API_KEY=your-openai-api-key
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret
META_REDIRECT_URI=http://localhost:4000/api/integrations/instagram/callback
N8N_WEBHOOK_URL=
N8N_WEBHOOK_SECRET=
```

Generate a 32-byte encryption key with `openssl rand -hex 32`. Do not commit `.env`, API keys, OAuth tokens, or real webhook secrets.

## n8n setup

1. Import `n8n/ostras-events.workflow.json` into your n8n instance.
2. Activate the workflow and copy its **Production URL** from the Webhook node.
3. Set `N8N_WEBHOOK_URL` to that URL in the backend environment.
4. Generate a private secret with at least 16 characters and set it as `N8N_WEBHOOK_SECRET` in the backend environment. Use the same secret in n8n if you add signature verification.
5. Restart the backend, open **Settings → n8n workflow automation**, and send a test event.
6. Extend the starter workflow after its Webhook node with the actions you need, such as Slack notifications, CRM updates, or approval steps.

Each request includes an event name in both the JSON body and `x-ostras-event`, an ISO timestamp in `x-ostras-timestamp`, and `x-ostras-signature` (`sha256=<hex>`). The signature is HMAC-SHA256 over the exact raw JSON body, using `N8N_WEBHOOK_SECRET`. Verify it in n8n or a trusted gateway before taking sensitive actions. Webhook delivery is best-effort: a failed n8n request is logged and does not block content creation or publishing.

## Instagram publishing setup

Instagram publishing needs an Instagram Business or Creator account and a Meta developer app configured for Instagram Login. Add the callback URL from `META_REDIRECT_URI` to your Meta app, enable the required Instagram business basic and content publishing permissions, and complete Meta's review requirements before connecting accounts outside development roles.

Instagram fetches the image from a public HTTPS URL. Set `API_PUBLIC_URL` to a reachable HTTPS API host in production. For production deployments, use durable object storage/CDN for image files instead of the local uploads folder.

## Automatic publishing

Automatic publishing is disabled by default. Connect Instagram, add topics, set a weekly rhythm and timezone, then enable it in brand settings. Ostras prepares up to three posts ahead and the MongoDB-backed worker checks for due posts every 30 seconds. Failed posts remain in the library with an error message and can be reviewed and retried.

Run one scheduler-enabled API instance. Before scaling the API horizontally, move scheduled work to a dedicated worker and use a distributed lease or queue to prevent multiple instances processing the same work.

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create an account and brand workspace |
| POST | `/api/auth/login` | Start a secure session |
| GET | `/api/auth/me` | Load the current user and brand |
| GET, PATCH | `/api/brand` | Read or update brand and publishing settings |
| GET | `/api/dashboard` | Read post counts, recent activity, and upcoming content |
| GET, POST | `/api/posts` | List or create posts |
| POST | `/api/posts/generate` | Generate a caption and optional artwork |
| POST | `/api/posts/:postId/schedule` | Schedule a draft |
| POST | `/api/posts/:postId/publish` | Publish a reviewed post now |
| GET | `/api/integrations/n8n/status` | Check n8n configuration |
| POST | `/api/integrations/n8n/test` | Send a signed n8n test event |
| GET | `/api/integrations/instagram/connect` | Start Instagram Login |
| DELETE | `/api/integrations/instagram` | Disconnect Instagram |

## Deployment

Deploy `frontend/` and `backend/` as separate services, or deploy from the workspace root using the provided npm workspaces. Configure HTTPS, exact `WEB_ORIGIN`, `API_PUBLIC_URL`, `NEXT_PUBLIC_API_URL`, MongoDB, and all required secrets. Use a private MongoDB cluster, store secrets in the host's secret manager, back up MongoDB, and use durable storage for generated images. Configure the Meta app's privacy policy and data deletion requirements before requesting production access.
