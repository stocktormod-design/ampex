# AMPEX

Prosjektstyringsapp for norske elektroentreprenorer.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Auth, Database, Storage)

## Kom i gang

1. Kopier variabler fra `.env.example` til `.env.local`.
2. Fyll inn Supabase-verdier.
3. Start utviklingsserver:

```bash
npm run dev
```

Appen kjøres på [http://localhost:3000](http://localhost:3000).

## Vercel (ampex-v1ke)

- Knytt **GitHub-repoet** til **ett** Vercel-prosjekt (f.eks. **ampex-v1ke**), og arkiver duplikat-prosjekter for å unngå rot med URL-er og miljøvariabler.
- Sett **`NEXT_PUBLIC_APP_URL`** til den faktiske produksjons-URL-en for det prosjektet (f.eks. `https://…v1ke….vercel.app`).
- Etter databaseendringer: kjør migrasjoner mot Supabase (`supabase db push` eller SQL fra `supabase/migrations/` i dashboard).

## Struktur

- `app` — landing (`/`), auth (`/auth/*`), onboarding, dashboard, **lager** (`/dashboard/lager`)
- `components` — landing-seksjoner, `ui/*`, navigasjon
- `lib/supabase` — browser-, server- og admin-klient; `middleware.ts` for sesjon
- `supabase/migrations` — schema, RLS, triggers
- `types` — database-typer m.m.
