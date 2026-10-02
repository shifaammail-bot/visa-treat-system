# Visa Treat Desk

Next.js 14 (App Router) + TypeScript + Tailwind, backed by an existing Supabase project.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the Supabase URL, anon key and service role key.
3. `npm run dev` and open http://localhost:3000.

## Signing in

Every page except `/login` needs a Supabase session **and** an active row in `staff`
with the same email. The first admin has to be created by hand:

1. Supabase dashboard → Authentication → Users → **Add user** (email + password,
   tick "Auto confirm").
2. SQL editor:

   ```sql
   insert into public.staff (email, full_name, role)
   values ('you@example.com', 'Your Name', 'admin');
   ```

After that, admins create other staff from the Staff page (build step 2).

## Supabase clients

- `lib/supabase/client.ts` — browser client (Client Components)
- `lib/supabase/server.ts` — server client with cookie handling (Server Components, Route Handlers, Server Actions)
- `lib/supabase/admin.ts` — service-role client that bypasses RLS (server only)

Every table revokes `anon`, so all data reads go through the service-role client on the
server. The anon key is only used for Supabase Auth.

## Layout

- `app/(app)/` — signed-in pages, sharing the sidebar layout
- `app/login/` — sign-in page
- `middleware.ts` — refreshes the session and redirects signed-out visitors to `/login`
- `components/BrandLogo.tsx` — per-issuer logo; add one line to `LOGOS` to swap a
  placeholder wordmark for a real logo file in `public/logos/`
- `lib/vat.ts` — VAT arithmetic. Do not rewrite; the `set_visa_vat` trigger must agree with it.
