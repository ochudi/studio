# Greyform Studio

Back of house for Greyform: clients, projects, correspondence, documents,
invoices, money, calendar. Private, single user, installable on phone,
tablet and desktop as a PWA.

The full feature spec, architecture and build roadmap live in
[docs/SPEC.md](docs/SPEC.md).

## Setup

1. **Env.** Copy `.env.example` to `.env.local`. Reuse `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` from the greyform.org
   repo's `.env.local`. Set a fresh `STUDIO_PASSWORD` (long passphrase,
   different from the site admin password) and a random `CRON_SECRET`.
   Generate push keys once with `npx web-push generate-vapid-keys`.
2. **Database.** Paste `supabase/migrations/0001_studio_core.sql` into the
   Supabase SQL editor and run it. Idempotent; safe to re-run. It creates
   20 `studio_`-prefixed tables plus a private `studio` storage bucket, all
   locked behind RLS with no policies — only the server's service-role key
   gets in. The prefix matters: the Supabase project is shared with the
   site and other apps, and bare names like `reviews` are already taken.
3. **Run.** `npm install && npm run dev` — the app is on
   [http://localhost:3020](http://localhost:3020) (port 3020: it can run
   beside the site, and Docker holds 3001 to 3018 on this machine).

## Deploy

Deploy to Vercel as its own project. Add the env vars from `.env.local`.
Suggested domain: `studio.greyform.org`. Every response carries
`X-Robots-Tag: noindex` and the whole app sits behind the password gate in
`src/middleware.ts`.

## Architecture notes

- Same design language and stack as greyform.org: Next.js 14 App Router,
  Tailwind with the shared monochrome token system, Fraunces/Inter/JetBrains
  Mono. One mental model across both repos.
- Same Supabase project as the site. This app owns every table except
  `public.inquiries`, which belongs to the site.
- Auth is the site's proven single-user signed-cookie pattern, ported to Web
  Crypto so the same HMAC check runs in Edge middleware and Node routes.
- Money is minor units + ISO currency, with the FX rate to the base currency
  snapshotted when a record is created — reports never drift with the market.
- The service worker handles push only. No offline cache of financial data.
