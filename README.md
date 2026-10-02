# Visa Treat Desk

Next.js 14 (App Router) + TypeScript + Tailwind, backed by an existing Supabase project.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the Supabase URL, anon key and service role key.
3. `npm run dev` and open http://localhost:3000 — the homepage lists the rows in the `issuers` table.

## Supabase clients

- `lib/supabase/client.ts` — browser client (Client Components)
- `lib/supabase/server.ts` — server client with cookie handling (Server Components, Route Handlers, Server Actions)
- `lib/supabase/admin.ts` — service-role client that bypasses RLS (server only)
