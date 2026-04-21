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

Appen kjores pa [http://localhost:3000](http://localhost:3000).

## Struktur

- `app` - routes og layouts
- `components` - UI-komponenter
- `lib` - hjelpekode, inkludert Supabase-klienter
- `types` - felles TypeScript-typer
