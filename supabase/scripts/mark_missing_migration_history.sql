-- Synkroniser migrasjonshistorikk når databasen allerede er satt opp (f.eks. via SQL Editor),
-- men `supabase_migrations.schema_migrations` mangler eldre versjoner.
-- Da sier `supabase db push` at lokale migrasjoner skal inn FØR siste migrasjon på remote.
--
-- Kjør i Supabase SQL Editor (lim inn KUN denne blokken). Kjør gjerne flere ganger — den er idempotent.

create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.schema_migrations (
  version text primary key
);

alter table supabase_migrations.schema_migrations
  add column if not exists name text;

alter table supabase_migrations.schema_migrations
  add column if not exists statements text[];

insert into supabase_migrations.schema_migrations (version, name, statements)
values
  ('20260421171500', '20260421171500_initial_schema.sql', array[]::text[]),
  ('20260421172000', '20260421172000_auth_profile_trigger.sql', array[]::text[]),
  ('20260421192000', '20260421192000_profile_role_guard.sql', array[]::text[]),
  ('20260422120000', '20260422120000_montor_apprentice_lager_barcode.sql', array[]::text[]),
  ('20260423120000', '20260423120000_warehouse_item_barcodes.sql', array[]::text[])
on conflict (version) do nothing;
