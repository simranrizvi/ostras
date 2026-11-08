# Deployment and operations

## Local Docker stack

```bash
npm ci
npm run setup
docker compose up --build
```

Compose starts MongoDB, the API, worker and Next.js as separate services. Host ports bind to loopback, not public interfaces. Named volumes preserve the MongoDB database and generated media; API/worker share the media volume. `docker compose down` retains volumes; do not use `down -v` unless you intend to delete all data.

The supplied Compose configuration is for local development. Its MongoDB service has no credentials and should not be exposed publicly. For production use a private authenticated database/Atlas, backups, a reverse proxy and a secret manager. Docker files are included; validate image builds in your deployment environment.

## Production configuration

1. Use Node 22.13+ (Docker uses Node 22). Run `npm ci` from the workspace root.
2. Set `NODE_ENV=production`, private MongoDB credentials, a random JWT secret and encryption key, HTTPS `WEB_ORIGIN`/`API_PUBLIC_URL` and an exact Meta callback URL. Use a valid 64-character hexadecimal encryption key.
3. Prefer same-site frontend/API hosts such as `studio.example.com` and `api.example.com`. Cookies are HTTP-only, host-only, Secure in production and SameSite=Lax. Unrelated frontend/API sites are not supported by this cookie configuration.
4. Set `TRUST_PROXY_HOPS` to the exact trusted proxy count. Do not trust arbitrary forwarded IP headers. Local process rate limiting is per API instance; use a shared gateway limit before horizontally scaling.
5. Run `npm run db:indexes` **before** starting the worker. It creates declared indexes without dropping existing indexes, including the unique brand/schedule index used to prevent duplicate automation slots. Resolve existing conflicting data before retrying a failed index build. Production disables automatic indexing.
6. Build with the correct browser API URL: `NEXT_PUBLIC_API_URL=https://api.example.com npm run build`. In Docker pass the same value as the `NEXT_PUBLIC_API_URL` frontend build argument; changing runtime variables alone does not change browser bundles.
7. Run the API (`npm run start -w @social-flow/backend`), web (`npm run start -w @social-flow/frontend`) and worker (`npm run worker -w @social-flow/backend`) as independent managed services. Monitor `/api/health`, `/api/ready` and worker logs. The worker has no HTTP port.
8. API/worker need the same durable `UPLOAD_DIR`. Mount it into both and back it up. The API serves generated images publicly for Meta fetches. A multi-host deployment needs shared storage or an object-storage adapter; ephemeral instance disks are unsuitable.
9. Route HTTPS traffic through your proxy; allow adequate upstream timeouts for AI generation (up to 120 seconds/provider call). Allow 150 seconds for graceful shutdown. The worker drains current work before disconnecting.
10. Configure Meta permissions, app review, privacy policy and data deletion requirements. Complete a staging generation/OAuth/publishing test with your own credentials before accepting real users.

## Upgrade from the original Social Flow repository

- Back up MongoDB and generated uploads first. No production database is changed by pulling this code.
- Stop old API instances before starting the new dedicated worker. The API no longer embeds a scheduler; `npm run dev`/`npm start` at the root now launch all three processes.
- The default database name changed from `ostras` to `social-flow`. **Keep your existing `MONGODB_URI`** to retain existing data; changing the URI creates a separate database.
- The default upload location is consistently relative to `backend/`. If the old API was launched from another directory, configure an absolute `UPLOAD_DIR` or move the old media into the shared directory while preserving filenames/URLs.
- Session/OAuth cookie names changed to `social_flow_session` / `social_flow_oauth_state`. Users must log in again. Token encryption remains AES-256-GCM; keep the existing encryption key.
- Existing MongoDB collections and IDs remain compatible. New processing metadata, generation lease and container fields are additive. Run the index creation command before enabling automation.
- Existing publishing rhythms above seven posts/week should be reduced to 1–7; current automation intentionally creates one post per selected publishing day.
- Existing PNG images are not converted automatically. Replace them with public JPEG URLs before publishing.
- n8n workflow/header/source names now use `social-flow`; update consumers and import the renamed workflow. Importing a workflow does not activate it or configure verification.
- Legacy rewards/submissions Supabase functions and local VS Code settings were removed because they are unrelated to the social-content product. They remain recoverable in Git history.

## Failure handling

The worker checks due posts every 30 seconds. API requests that queue publishing return 202, not a provider media ID. Review final status in the library. Interrupted processing older than 15 minutes becomes failed and is not automatically retried. Check Instagram before retrying an ambiguous result; network failures cannot provide exactly-once guarantees across the database and provider.

Automatic generation and due publishing run independently, so a slow generation request does not block due publishing. A 15-minute generation lease is stored per brand. A crashed worker's lease expires; atomic post claims protect publication across multiple workers. Use a single worker initially and monitor throughput before scaling. Indexes are required for schedule uniqueness.

The existing seven-day JWT sessions have no refresh/revocation store; logout clears the browser cookie. Password reset/email verification, team RBAC, provider analytics and persistent webhook retries are not implemented. Webhook failures are logged and do not undo database updates. Add a transactional outbox if reliable downstream delivery is required.
