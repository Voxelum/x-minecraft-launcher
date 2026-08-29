# XMCL offline-auth backend

Cloudflare Worker backend for password-protected custom offline accounts.

The automatic local `Steve` account does not use this service. Custom offline
accounts are registered here and receive a session token on login. Sessions
last one year and are extended when the launcher validates the account.

## Setup

1. Create a Supabase project.
2. Run [`schema.sql`](./schema.sql) in the Supabase SQL editor.
3. In Supabase Storage, create a bucket named `skins`. Make it public if Minecraft clients should fetch the returned URL directly.
4. Install dependencies in this directory with `pnpm install`.
5. Set Worker secrets:

```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SECRET_KEY
```

Optionally set `SUPABASE_STORAGE_PUBLIC_URL` when the public storage base URL
differs from `${SUPABASE_URL}/storage/v1/object/public`.

6. Start locally with `pnpm dev` or deploy with `pnpm deploy`.

The Supabase secret must never be placed in XMCL or exposed to clients.

## API

```text
POST /v1/accounts/register
  { username, password, offlineUuid }

POST /v1/accounts/login
  { username, password }

GET /v1/accounts/me
  Authorization: Bearer <session>

PUT /v1/accounts/me/skin
  Authorization: Bearer <session>
  Content-Type: image/png
  64x64 or 64x32 PNG, up to 1 MiB

PUT /v1/accounts/me/cape
  Authorization: Bearer <session>
  Content-Type: image/png
  64x32 PNG, up to 1 MiB

DELETE /v1/accounts/me/cape
  Authorization: Bearer <session>

GET /v1/profiles/:offlineUuid
  Public application profile lookup.

Yggdrasil-compatible server API (also available below `/yggdrasil`):

GET /
  Service metadata. Configure authlib-injector with this Worker URL.

GET /sessionserver/session/minecraft/profile/:offlineUuid
  Public Minecraft profile containing the texture property.

GET /sessionserver/session/minecraft/hasJoined?username=:username&serverId=:id
  Resolves an account by username for a multiplayer server.

POST /sessionserver/session/minecraft/join
  Accepts the client join notification.
```

Passwords are stored as salted PBKDF2-SHA-256 verifiers. The format includes
the algorithm and work factor so the verifier can be upgraded later.

For production, set `CORS_ORIGIN` to the exact launcher origin instead of `*`
and configure Cloudflare rate limiting/WAF rules. The Supabase service key must
remain Worker-only and must never be included in XMCL.

## Making skins visible in multiplayer

Deploy this Worker to a public HTTPS URL and configure the multiplayer server's
authlib-injector or equivalent authentication integration to use that URL. If
the Worker is deployed at `https://auth.example.com`, use
`https://auth.example.com/yggdrasil` as the Yggdrasil API URL.

The server must query this service. A normal cracked vanilla server does not
fetch custom Yggdrasil skins. If the host does not allow authlib-injector or a
server skin plugin, custom skins cannot be synchronized by the launcher alone.
The `skins` Supabase bucket must remain public because Minecraft clients fetch
the image URL directly.

Capes are stored under the `skins/capes/` prefix in the same public bucket.
