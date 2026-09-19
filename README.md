# AllCombiner

> AI-powered image fusion SaaS — combine two photos of people into a single photorealistic image, preserving identity, anatomy and natural interaction.

Site: **https://www.allcombiner.com**

---

## Table of contents

1. [Architecture](#architecture)
2. [Installation](#installation)
3. [Environment variables](#environment-variables)
4. [Database](#database)
5. [Seed admin](#seed-admin)
6. [Local launch](#local-launch)
7. [OpenRouter](#openrouter)
8. [AI models](#ai-models)
9. [Administration](#administration)
10. [i18n](#i18n)
11. [Tests](#tests)
12. [Deployment](#deployment)
13. [Security](#security)

---

## Architecture

AllCombiner is built on a modern TypeScript / React stack:

| Layer | Technology |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) |
| Language | **TypeScript 5** (strict) |
| Styling | **Tailwind CSS 4** + **shadcn/ui** (New York) |
| Database | **Prisma ORM** (SQLite for dev — schema is portable to PostgreSQL) |
| Auth | **NextAuth.js v4** (credentials, JWT sessions, role-based) |
| i18n | **next-intl v4** (EN / FR / ES, prefix-always routing) |
| AI | **OpenRouter** (server-side only) |

### Project structure

```
src/
├── app/
│   ├── [locale]/              # Locale-prefixed routes (EN/FR/ES)
│   │   ├── page.tsx           # Home
│   │   ├── fusion/            # Fusion tool
│   │   ├── pricing/           # DB-driven pricing
│   │   ├── faq/ contact/ legal/ privacy/
│   │   ├── login/ signup/ dashboard/
│   │   └── admin/             # Protected admin section
│   ├── api/
│   │   ├── fusion/route.ts            # POST fusion
│   │   ├── contact/route.ts           # POST contact
│   │   ├── auth/
│   │   │   ├── [...nextauth]/         # NextAuth handler
│   │   │   └── register/              # POST signup
│   │   └── admin/
│   │       ├── stats/                 # Dashboard stats
│   │       ├── models/                # CRUD models
│   │       │   └── [id]/{activate,test,route}/
│   │       ├── openrouter/test/       # Test OpenRouter connectivity
│   │       ├── fusion-settings/       # Central prompt
│   │       ├── pricing/               # CRUD plans
│   │       ├── users/                 # List/role/delete users
│   │       └── site-settings/         # Generic key-value
│   ├── layout.tsx             # Root layout (theme + toasters)
│   ├── globals.css            # Design system (emerald/teal/amber)
│   ├── sitemap.ts             # Multi-locale sitemap
│   └── robots.ts
├── components/
│   ├── layout/                # SiteHeader, SiteFooter
│   ├── home/                  # HomePage
│   ├── fusion/                # FusionPage
│   ├── auth/                  # LoginForm, SignupForm, ContactForm, AuthProvider
│   └── admin/                 # All admin client components
├── lib/
│   ├── db.ts                  # Prisma client singleton
│   ├── auth.ts                # NextAuth config (role on token)
│   ├── server.ts              # requireAuth/requireAdmin/apiRoute/errorResponse
│   ├── rate-limit.ts          # In-memory per-IP rate limiter
│   ├── upload.ts              # Magic-byte MIME sniff + size/dim validation
│   └── ai/
│       ├── provider.ts        # AIProvider interface + getProvider()
│       ├── providers/
│       │   └── openrouter.ts  # OpenRouterProvider
│       └── fusion.ts          # runFusion() orchestration + central prompt
├── i18n/
│   ├── routing.ts             # Locales, navigation helpers
│   ├── request.ts             # Server-side locale resolution
│   └── use-translated-pathname.ts
└── middleware.ts              # next-intl middleware

messages/
├── en.json fr.json es.json    # All UI strings

prisma/
└── schema.prisma              # User, Account, Session, AIModel, Generation,
                               # SiteSettings, PricingPlan, ContactMessage

scripts/
└── seed.ts                    # Admin + models + pricing + prompt
```

### Key design decisions

- **AIProvider abstraction**: `AIProvider` interface + `OpenRouterProvider` implementation. Adding a new provider later (Replicate, Stability, in-house) only requires implementing the interface and wiring it in `getProvider()` — no fusion logic changes.
- **Model is read from DB**: The fusion endpoint calls `getActiveModel()` which queries the DB for `isActive=true`. The admin "Set as active" button flips a single flag in DB. No code change, no redeploy.
- **Central prompt in DB**: The prompt sent to the AI lives in `SiteSettings.fusion_prompt`. The admin can edit it via the UI (`/admin/fusion-settings`) without touching code.
- **Identities preserved**: The default prompt explicitly instructs the model to preserve face shape, eyes, eyebrows, nose, mouth, jawline, ears, hair, skin tone, age and distinctive features — and to **never blend, average, morph or invent** a new face.

---

## Installation

Prerequisites:
- **Node.js 18+** or **Bun 1.1+**
- **Python 3** (only for the seed script's hash check, optional)

```bash
# Clone the repository (when public)
git clone https://github.com/monhost-hub/prgfusion.git
cd allcombiner

# Install dependencies
bun install            # or: npm install / pnpm install
```

---

## Environment variables

Copy `.env.example` to `.env` and fill in real values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | yes | Public URL (used for SEO, OG, sitemap) |
| `DATABASE_URL` | yes | SQLite path or PostgreSQL URL |
| `AUTH_SECRET` | yes | Random 32+ char string (`openssl rand -base64 32`) |
| `AUTH_TRUST_HOST` | yes | `true` for dev, set appropriately in prod |
| `ADMIN_EMAIL` | seed only | Initial admin email |
| `ADMIN_PASSWORD` | seed only | Initial admin password |
| `ADMIN_NAME` | seed only | Initial admin display name |
| `OPENROUTER_API_KEY` | for AI | Server-side only — never exposed to client |
| `OPENROUTER_SITE_URL` | optional | Shown in OpenRouter rankings |
| `OPENROUTER_APP_NAME` | optional | Shown in OpenRouter rankings |
| `RATE_LIMIT_FUSION_PER_HOUR` | optional | Default: 10 |
| `RATE_LIMIT_CONTACT_PER_HOUR` | optional | Default: 5 |
| `RATE_LIMIT_AUTH_PER_HOUR` | optional | Default: 20 |
| `MAX_UPLOAD_SIZE_MB` | optional | Default: 10 |
| `MAX_UPLOAD_DIMENSION` | optional | Default: 4096 |

> ⚠️ **Never commit `.env`.** The `.gitignore` excludes it. All secrets stay server-side.

---

## Database

The default config uses SQLite for fast local testing. The schema is portable to PostgreSQL:

```prisma
datasource db {
  provider = "sqlite"   // ← change to "postgresql" for production
  url      = env("DATABASE_URL")
}
```

To switch to PostgreSQL:
1. Change `provider = "sqlite"` to `provider = "postgresql"` in `prisma/schema.prisma`.
2. Update `DATABASE_URL` in `.env` to a `postgresql://` URL.
3. Run `bun run db:push`.

### Push the schema

```bash
bun run db:push
```

This creates the SQLite file (or syncs your Postgres DB) and generates the Prisma Client.

---

## Seed admin

The seed script creates:

- The initial **admin user** (from `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- Three **AI models**: Nano Banana 2 Lite (active by default), Nano Banana 2, Nano Banana Pro
- Four **pricing plans**: Free, Starter, Pro (featured), Business
- The **central fusion prompt** in `SiteSettings`

```bash
bun run db:seed
```

The script is **idempotent** — safe to run multiple times.

Default admin credentials (from `.env`):
- Email: `admin@allcombiner.com`
- Password: `Admin123!2024`

⚠️ **Change the admin password immediately** on first login (or update `ADMIN_PASSWORD` in `.env` and re-seed).

---

## Local launch

```bash
bun run dev
```

Open `http://localhost:3000` — you'll be redirected to your default locale (`/en`).

To lint:

```bash
bun run lint
```

---

## OpenRouter

AllCombiner uses [OpenRouter](https://openrouter.ai) as its AI inference provider. OpenRouter routes the request to the underlying model (Google Nano Banana family).

### Get an API key

1. Create an account at https://openrouter.ai
2. Go to **Keys** → **Create Key**
3. Copy the key (starts with `sk-or-v1-…`)
4. Paste it into `.env` as `OPENROUTER_API_KEY`

### Test the connection

Admin → **OpenRouter** → **Test connection**. This hits OpenRouter's `/models` endpoint with your key and reports latency.

> The API key is stored exclusively in the server's environment. It is **never** sent to the client, never appears in client bundles, and is never logged.

---

## AI models

The admin can manage models at **Admin → AI Models**.

| Action | Effect |
|---|---|
| Add model | Creates a new AIModel row with a providerId (e.g. `google/nano-banana-2-lite`) |
| Edit model | Changes the display name, providerId, cost, enabled flag |
| Set as active | **The single most important action** — this is the model that will be used for all future fusions. Only one model can be active at a time. |
| Test model | Sends a lightweight request to validate the model responds |
| Enable / Disable | Disabled models cannot be activated |
| Delete | Cannot delete the currently active model |

### Currently configured models

| Display name | OpenRouter model id | Default |
|---|---|---|
| Nano Banana 2 Lite | `google/nano-banana-2-lite` | ✓ active |
| Nano Banana 2 | `google/nano-banana-2` | |
| Nano Banana Pro | `google/nano-banana-pro` | |

> If OpenRouter renames a model id, just edit it in the admin UI — no code change required.

---

## Administration

The admin dashboard is at `/admin` (under any locale prefix, e.g. `/en/admin`).

### Sections

| Section | Purpose |
|---|---|
| Dashboard | Live stats: users, generations, success rate, errors, active model, estimated cost |
| Users | List users, promote to admin, demote, delete (cannot delete/demote self) |
| Generations | Audit log of every fusion run (status, duration, cost, error) |
| AI Models | Manage models — see above |
| OpenRouter | API key status, masked preview, test connection |
| Fusion Settings | Edit the central prompt (sent to the AI with both reference images) |
| Pricing | CRUD pricing plans — changes appear immediately on the public pricing page |
| Site Settings | Generic key-value store for any additional configuration |

### Security model

- All `/admin/*` routes are protected **server-side** in the `admin/layout.tsx`. Non-admins are redirected to home.
- All `/api/admin/*` routes call `requireAdmin()` which throws 401 (not authenticated) or 403 (not admin).
- A regular user cannot access admin APIs or pages, even by direct URL navigation.

---

## i18n

Three locales are supported out of the box:

| Code | Language | Flag |
|---|---|---|
| `en` | English | 🇬🇧 |
| `fr` | Français | 🇫🇷 |
| `es` | Español | 🇪🇸 |

- Default locale: `en`
- URL prefix: **always** (e.g. `/en/`, `/fr/faq`, `/es/pricing`)
- Translation files: `messages/{en,fr,es}.json`
- All UI strings (nav, pages, CTAs, forms, errors, dashboard, admin) are translated
- The language switcher in the header preserves the current path

### Adding a new locale

1. Add the code to `routing.locales` in `src/i18n/routing.ts`.
2. Create `messages/{code}.json` (copy `en.json` and translate).
3. Add the flag/name to `localeNames` and `localeFlags`.

---

## Tests

The project includes an end-to-end test script that verifies:

- ✅ Authentication (register, login, session, role)
- ✅ Admin access control (401 for unauthenticated, 403 for non-admin)
- ✅ **Model switching** — activating a different model from `/api/admin/models/[id]/activate` changes the active model used by future fusions (verified by reading `/api/admin/stats` before and after)
- ✅ Pricing CRUD
- ✅ Fusion API validation (auth, data URL, MIME, size)
- ✅ Rate limiting (contact, fusion, auth)
- ✅ Duplicate email registration (409)
- ✅ Weak password rejection (400)

To run the test suite (requires the dev server to be running on `localhost:3000`):

```bash
bash /tmp/test-model-switch.sh
bash /tmp/test-fusion.sh
```

---

## Deployment

### Vercel (recommended)

1. Push the repo to GitHub.
2. Import the project in Vercel.
3. Set all env vars from `.env.example` in Vercel's project settings.
4. Set `DATABASE_URL` to a managed PostgreSQL (Neon, Supabase, etc.).
5. Change `provider = "sqlite"` to `provider = "postgresql"` in `prisma/schema.prisma`.
6. Run `bun run db:push` and `bun run db:seed` once (via Vercel's build command or a one-off script).

### Docker / self-host

The Next.js build produces a standalone server in `.next/standalone`. Use the included `Dockerfile` pattern:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Set the same env vars in your container orchestrator.

---

## Security

AllCombiner implements defense-in-depth:

| Threat | Mitigation |
|---|---|
| XSS | React escapes by default; no `dangerouslySetInnerHTML` |
| CSRF | NextAuth CSRF tokens on all auth endpoints |
| SQL injection | Prisma parameterized queries |
| Malicious upload | Magic-byte MIME sniff + size + dimensions validation (server-side) |
| Secret leak | All secrets server-side only; `OPENROUTER_API_KEY` never in client bundle |
| Admin access | Server-side route guard + `requireAdmin()` on every admin API |
| Cross-user data access | All Generation queries filter by `userId` from the session |
| Rate limiting | In-memory per-IP / per-user buckets on fusion, contact, auth |
| File size abuse | `MAX_UPLOAD_SIZE_MB` enforced server-side |
| Stack trace leak | `errorResponse()` sanitizes all 500s to a generic message |
| OpenRouter abuse | Rate-limited per user + per IP; admin can disable models instantly |

### What we never expose

- API keys (any provider)
- Stack traces
- Internal IDs beyond what's needed for the UI
- Other users' data
- The full OpenRouter raw response (kept server-side for audit only)

---

## License

Proprietary — © AllCombiner. All rights reserved.
