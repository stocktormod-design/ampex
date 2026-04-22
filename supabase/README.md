# Supabase-migrasjoner

## Når `db push` sier «Found local migration files to be inserted before the last migration…»

Det betyr at **remote migrasjonshistorikk** (`supabase_migrations.schema_migrations`) ikke har alle versjonene som finnes lokalt i `supabase/migrations/`.

**Ikke bruk `db push --include-all` her** med mindre du vet nøyaktig hva du gjør: den kan prøve å kjøre `initial_schema` og andre migrasjoner på nytt og skape konflikter.

### Alternativ A — SQL Editor (trygg for «allerede kjørt manuelt»)

Kjør innholdet i:

- `supabase/scripts/mark_missing_migration_history.sql`

(Det oppretter tabellen hvis den mangler, og markerer alle lokale migrasjonsversjoner som «applied» uten å kjøre SQL-filene.)

### Alternativ B — CLI (etter `supabase login` + `supabase link`)

```bash
npm run db:repair:baseline
npm run db:migration:list
npm run db:push
```

## Vanlig flyt

```bash
npx supabase link
npm run db:migration:list
npm run db:push
```

## Automatisk i GitHub Actions

Workflow: `.github/workflows/supabase-migrations.yml`

Den kjører `supabase db push` automatisk ved push til `main` når filer i `supabase/migrations/` endres.

Sett følgende repository secret i GitHub:

- `SUPABASE_DB_URL` = full Postgres connection string til Supabase-databasen.

Når secret er satt, trengs ikke manuell migrering i vanlig flyt.

## Feil: `invalid input value for enum app_role: "apprentice"`

Skjer ofte hvis `20260422120000` er **registrert** i migrasjonshistorikk, men **ikke** faktisk kjørt på databasen.

**Anbefalt:** kjør `npm run db:push` — migrasjonen `20260424120000_fix_app_role_enum.sql` retter enum idempotent.

**Alternativ:** kjør `scripts/fix_app_role_enum.sql` i SQL Editor (samme innhold).
