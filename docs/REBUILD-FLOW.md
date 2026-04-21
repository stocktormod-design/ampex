# AMPEX — full flyt og kontekst for omskriving (struktur beholdes)

> **2026-04:** `app/`-UI, `components/`, auth-ruter og debug er fjernet; `lib/supabase/*`, `supabase/migrations/`, Vercel/Supabase env beholdes. Middleware er midlertidig no-op til auth bygges pa nytt.

Dette dokumentet beskriver **produktet**, **teknisk stack**, **mappestruktur**, **brukerreiser**, **data/RLS**, **auth-mønster**, **miljøvariabler** og **kjente fallgruver**. Målet er at en reviewer (f.eks. Claude) kan gi feedback på arkitektur, sikkerhet og flyt før/under en **omprogrammering** der repo-strukturen i stor grad beholdes.

---

## 1. Produkt (MVP-retning)

- **Målgruppe:** Norske elektroentreprenører (multi-tenant SaaS).
- **Språk i UI:** Norsk der det er implementert.
- **MVP:** Innlogging + enkle verktøy; profesjonell landing; **firma-onboarding**; **owner/admin kan opprette brukere** i samme firma; kjøp/abonnement senere.
- **Merke:** «Ampex» / AMPEX.

---

## 2. Teknisk stack (beholdes typisk)

| Lag | Valg |
|-----|------|
| Framework | Next.js 14 App Router, TypeScript |
| UI | Tailwind CSS, shadcn-inspirerte komponenter |
| Auth + DB | Supabase (Auth, Postgres, RLS, Storage) |
| Hosting | Vercel (antatt) |
| SSR-klient | `@supabase/ssr` (`createServerClient`, cookies) |
| Admin / service | `supabase-js` med `SUPABASE_SERVICE_ROLE_KEY` (kun server) |

---

## 3. Mappestruktur (intensjon: beholdes)

```
app/
  layout.tsx                 # Root layout, fonter, ev. debug-chrome
  page.tsx                   # Landing (markedsføring)
  globals.css
  fonts/                     # lokale woff (Geist)
  api/debug/health/route.ts  # valgfri feilsøk-JSON når AMPEX_DEBUG=1
  auth/
    login/page.tsx           # skjema (RSC uten Supabase/cookies)
    login/actions.ts         # server action: signInWithPassword
    register/page.tsx
    register/actions.ts      # server action: signUp
    callback/route.ts        # GET: exchangeCodeForSession → redirect
  onboarding/page.tsx      # opprett firma + koble profil (admin-klient)
  dashboard/
    layout.tsx               # nav, signOut, profil/firma
    page.tsx                 # hoved dashboard
    settings/users/page.tsx  # opprett brukere (admin API)
components/
  dashboard-nav.tsx
  ui/                        # Card, Alert, Button, NativeInput, SubmitButton, …
  debug-chrome.tsx           # banner når AMPEX_DEBUG
lib/
  utils.ts
  debug.ts                   # isAmpexDebugEnabled, debugLog
  safe-next-path.ts          # intern redirect etter login
  supabase/
    client.ts                # browser client
    server.ts                # createClient() med cookies() — RSC / server actions
    middleware.ts            # session refresh + redirects
    admin.ts                 # service role — server-only
  auth/
    server.ts                # getUser cache, requireUser (brukes varierende)
middleware.ts                # kaller updateSession
supabase/migrations/         # schema, RLS, triggers, storage policies
types/database.ts            # Supabase types (evt. løs typing i app)
.env.example
```

**Omprogrammering:** Bytt implementasjon inne i disse «krokene»; behold rutehierarki og `lib/supabase/*`-grenser om mulig.

---

## 4. Miljøvariabler

| Variabel | Bruk |
|----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-prosjekt-URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Offentlig anon key (klient + server SSR) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Kun server** — bypass RLS (admin.createUser, onboarding companies, …) |
| `NEXT_PUBLIC_APP_URL` | Base URL for redirects i e-post (`/auth/callback`), f.eks. `https://xxx.vercel.app` |
| `AMPEX_DEBUG` (valgfri) | `1` / `true` — logger `[ampex:debug]`, `/api/debug/health`, banner |

**Supabase Dashboard:** Site URL + Redirect URLs må matche faktisk app-URL (inkl. `/auth/callback`).

---

## 5. Brukerflyt (høy nivå)

```
[Landing /]
    → Registrer → /auth/register
    → Logg inn   → /auth/login

/auth/register (skjema)
    → server action signUp → Supabase signUp
    → e-postbekreftelse (Supabase-innstilling)
    → bruker klikker lenke → /auth/callback?code=…
    → exchangeCodeForSession → redirect til typisk /onboarding

/auth/login (skjema)
    → server action signInWithPassword
    → redirect til `next` (sanitisert intern path) eller /dashboard

/onboarding (krever innlogget)
    → opprett `companies` + oppdater `profiles` (company_id, role owner)
    → bruker **admin-klient** for inserts/updates som RLS ellers blokkerer

/dashboard (krever innlogget + typisk firma)
    → layout: nav, logg ut

/dashboard/settings/users
    → krever profile.role ∈ {owner, admin}
    → opprett bruker via **auth.admin.createUser** + oppdater `profiles` med admin-klient
```

---

## 6. Middleware-flyt (detalj)

**Matcher:** Alt unntatt `_next/static`, `_next/image`, `favicon.ico`, vanlige bildeendelser.

**Rekkefølge (nåværende intensjon):**

1. **`/auth/callback`**  
   - `NextResponse.next()` med **ingen** `getUser`/redirect i middleware.  
   - Grunn: OAuth-kode byttes i route handler; unngå å forstyrre den flyten.

2. **Mangler `NEXT_PUBLIC_SUPABASE_URL` eller anon key**  
   - `next()` (appen kan vise feil ved submit i stedet).

3. **Ellers:** `createServerClient` (Edge) med cookie `getAll` / `setAll` (oppdater `response` når cookies settes).

4. **`getUser()`** (JWT fra cookies).

5. **Hvis bruker finnes** og path er **`/auth/login` eller `/auth/register`**  
   - Redirect til **`/dashboard`** (allerede innlogget).

6. **Beskyttede ruter:** path starter med `/dashboard` eller `/onboarding`  
   - Hvis **ingen bruker** → redirect til `/auth/login?next=<original-path>`.

7. **Catch** på middleware-feil → `next()` (fail-open; kan diskuteres sikkerhetsmessig).

**Viktig lærdom:** Tidligere ble **alle** `/auth/*` hoppet over for Supabase på Edge; det ga RSC-problemer på **login-siden** når `createClient()`/`cookies()` ble brukt i page. Nå: **login/register-sider uten Supabase i RSC**; session/«allerede innlogget» i middleware.

---

## 7. Server actions og `redirect()`

- Next.js `redirect()` kaster **`NEXT_REDIRECT`**.  
- **Må ikke** fanges i generell `catch` uten `isRedirectError` / rethrow — ellers brekkes redirects eller man får rare produksjonsfeil.

---

## 8. Postgres datamodell (kort)

**Kjerne multi-tenant:**

- `companies` — firma (`org_number` unik).
- `profiles` — 1:1 med `auth.users` (`id` FK), `company_id`, `role` enum `owner | admin | worker`, `full_name`, `phone`.

**Domene (schema finnes; ikke nødvendigvis brukt i UI ennå):**

- `projects`, `project_assignments`, `drawings`, `pins`, `warehouses`, `warehouse_items`, `item_scans` — med `company_id` eller kobling via prosjekt.

**Hjelpefunksjon (security definer):**

- `get_user_company_id()` — brukes i RLS policies.

**Trigger:**

- `on_auth_user_created` på `auth.users` → `handle_new_user()` → `INSERT` into `profiles` (full_name/phone fra `raw_user_meta_data`).

**RLS:** Aktivert på alle nevnte tabeller + storage-buckets (`drawings`, `pin_photos` policies i migrasjon).

**Profil-policy (senere migrasjon):**  
Eiere/admins kan oppdatere profiler iht. roller (`profiles_update_owner_or_self`, `profiles_update_admin_non_owner`).

---

## 9. Roller og tilgang (app-lag)

| Rolle | Typisk rettighet |
|-------|------------------|
| `worker` | Standard; begrenset skrive til domene-tabeller per RLS |
| `admin` | Mer skrive tilgang per RLS; kan opprette brukere (app) |
| `owner` | Firma-eier; kan opprette brukere inkl. annen owner (app-logikk) |

**Onboarding:** Setter `profiles.company_id` og `role = 'owner'`.

---

## 10. Admin / service role (når det brukes)

- **`lib/supabase/admin.ts`:** `createClient(url, SERVICE_ROLE_KEY)` — `persistSession: false`.
- **Bruk når RLS blokkerer legitime server-operasjoner**, f.eks.:
  - Insert `companies` ved onboarding.
  - `auth.admin.createUser` + `profiles.update` for inviterte brukere.

**Risiko:** Service role har full makt — aldri eksponer til klient; begrens bruk til konkrete server actions / route handlers med egen autorisasjon (sjekk `profiles.role` først).

---

## 11. UI-mønster (historisk begrunnelse)

- Noen shadcn/Base UI-komponenter skapte problemer med **RSC** + server actions.
- **Løsning brukt:** «Native» skjema (`<form action={…}>`, `<input>`, `SubmitButton` uten client-only imports fra problematiske steder), `Badge`/`Button` som `"use client"` der nødvendig, `buttonVariants` i egen fil for server.

Ved omskriving: reviewer kan foreslå **én konsistent** strategi (kun client forms vs. kun server) og teste mot Vercel Edge + Node.

---

## 12. Kjente fallgruver (samlet for feedback)

1. **`redirect()` inne i `try/catch`** uten rethrow av NEXT_REDIRECT.  
2. **`cookies()` / `createClient()` i RSC** på offentlige auth-sider → Vercel «Application error» / digest.  
3. **RLS** på `companies` ved insert som vanlig bruker uten admin-klient.  
4. **Åpen redirect** etter login hvis `next` ikke valideres (kun interne paths).  
5. **Mismatch** mellom faktisk URL i nettleser og `NEXT_PUBLIC_APP_URL` / Supabase redirect URLs.  
6. **Middleware fail-open** (`catch` → `next()`) — kan gi tilgang til beskyttede ruter ved feil; reviewer bør vurdere fail-closed for `/dashboard`.  
7. **Next 14.2.x** — npm melder sikkerhetsoppdatering; vurder oppgradert patchversjon.

---

## 13. Spørsmål til reviewer (Claude)

- Bør **all** auth-guard skje i **middleware**, eller beholde **layout-level** `getUser` på `/dashboard`? (Dobbelt sjekk vs. single source of truth.)
- Bør **onboarding** være egen route eller del av wizard etter første login?
- **Invitasjoner:** Fortsette med admin `createUser` + midlertidig passord, eller bytte til magic link / invite-only flyt?
- **RLS vs. service role:** Kan mer flyttes til sikre RPC (`security definer`) i stedet for service role i app-kode?
- **Observabilitet:** Beholde `AMPEX_DEBUG` eller bytte til standard OpenTelemetry / Vercel-only logging?

---

## 14. «Nuke» omfang (avklaring til deg selv / team)

- **Behold:** `app/` rutehierarki, `lib/supabase/*`, `supabase/migrations/`, `components/ui`-konsept, `.env.example`-felt.
- **Omprogrammer:** Innhold i pages, actions, middleware-detaljer, feilhåndtering, ev. konsolider `lib/auth/server.ts` med layout.

---

*Generert som kontekst for omskriving — oppdater dette dokumentet når flyten endres.*
