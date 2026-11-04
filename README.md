# Pavement Design Web App

A web app for **AASHTO 1993 flexible pavement design**: engineers sign in, organise designs
by project, design 3–5 layers with live per-layer checks, and export results to Excel or CSV.
*Prepared by Abenezer Tilahun.*

No service addresses are stored in the code: the database, API and site addresses all come from
environment variables (see **Deployment settings** below).

| Part | Service | Updates |
|---|---|---|
| Frontend | Vercel project (root `frontend`) | every push to `main` redeploys automatically |
| Backend | Render web service (root `backend`) | every push to `main` that changes `backend/` redeploys automatically |
| Database | Supabase (Session pooler) | migrations create and update the tables when the backend starts |

```
 Browser ──▶ frontend/  Next.js 16 (App Router, Tailwind)        → Vercel
                │  fetch(NEXT_PUBLIC_API_URL + "/designs/calculate", …)   JWT in the Authorization header
                ▼
            backend/   NestJS 12 + Prisma 6                      → Render (Web Service)
                │  engine/  AASHTO 1993 calculation (TypeScript port, checked against the Python engine)
                ▼
            PostgreSQL                                           → Supabase
```

The calculation is a TypeScript port of the tested Python/notebook engine. `backend/src/engine/engine.spec.ts`
checks it against **63 designs computed by Python**, including your spreadsheet example (R 98 %, W18 131×10⁶,
DBM MR 400,000 psi: SN1 = 1.901, D1 = 4.32 in). Every number must match to 1e‑9.

---

## Step 1 — Project structure

```
pavement-design-web/
├── backend/                  NestJS API
│   ├── prisma/schema.prisma  database tables (users, projects, designs)
│   ├── prisma/migrations/    SQL migrations (created by Prisma, committed to git)
│   ├── src/engine/           AASHTO 1993 engine + parity tests
│   ├── src/auth/             sign-up / login (bcrypt + JWT), JwtAuthGuard
│   ├── src/projects/         projects CRUD
│   ├── src/designs/          designs CRUD, live calculate, CSV/Excel export
│   ├── src/dashboard/        totals + chart data
│   ├── src/health/           GET /health
│   ├── src/setup.ts          CORS + ValidationPipe (shared by main.ts and tests)
│   ├── test/app.e2e-spec.ts  end-to-end tests against a real database
│   └── .env.example
├── frontend/                 Next.js app
│   ├── app/                  pages (dashboard, projects, designs, calculator, login, register)
│   ├── components/           UI + design editor (inputs, results, cross-section, SN chart)
│   ├── lib/api.ts            API client (uses NEXT_PUBLIC_API_URL)
│   ├── lib/auth.tsx          sign-in state
│   └── .env.example
├── tools/generate_engine_fixtures.py   regenerates the Python reference results
├── docker-compose.yml        local PostgreSQL for development
└── render.yaml               Render Blueprint for the backend
```

### Put it on GitHub (once)
Create an **empty repository** on github.com (no README), then in this folder:

```bash
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

---

## Run it on your PC

Needs **Node.js 20+** and **Docker Desktop** (for the local database).

```bash
docker compose up -d                       # 1. local PostgreSQL on port 5433

cd backend
cp .env.example .env                       # 2. fill in: DATABASE_URL and DIRECT_URL = the Docker URL in
                                           #    docker-compose.yml, JWT_SECRET = any long random string
npm install                                #    also runs "prisma generate"
npx prisma migrate deploy                  # 3. create the tables
npm run start:dev                          # 4. API on http://localhost:4000  (try /health)

cd ../frontend                             # (in a second terminal)
cp .env.example .env.local                 #    NEXT_PUBLIC_API_URL=http://localhost:4000 (or leave empty)
npm install
npm run dev                                # 5. app on http://localhost:3000
```

Tests: `cd backend && npm test` (engine parity, 68 tests) and `npm run test:e2e` (API + database, 18 tests).

---

## Step 2 — Database (Supabase + Prisma)

**Tables** (`backend/prisma/schema.prisma`):

| Table | Holds | Notes |
|---|---|---|
| `users` | email (unique), bcrypt password hash, name | passwords are never stored in plain text |
| `projects` | name, location, description, `owner_id` | index on (owner, updated); deleting a user deletes their projects |
| `designs` | `inputs` (JSON), `result` (JSON) + summary columns `adequate`, `total_sn`, `required_sn`, `total_thickness_mm`, `layer_count` | index on (project, updated); deleting a project deletes its designs |

The summary columns let lists and the dashboard work without opening the JSON.

**Create the Supabase database**
1. supabase.com → **New project**. Pick a region and use the **same region for Render** (`region:` in `render.yaml`),
   and **save the database password**.
2. Open the project → click **Connect** (top bar) → **Connection string** → **Session pooler**. Copy it:
   `postgresql://postgres.<project-ref>:<password>@<pooler-host>:5432/postgres`
   (replace `[YOUR-PASSWORD]` with your database password).

**The database structure is in the repo.** `backend/prisma/migrations/` holds every table, index, foreign key and
the row-level-security settings as SQL. On an **empty** Supabase project you do not create anything by hand:
Render runs `prisma migrate deploy` at start and builds it all. (There are no database functions or triggers.)

**Row-level security:** all tables have RLS switched on with no policies, and the `anon` / `authenticated` roles
have no access. Supabase's public Data API therefore can't read or change anything; only the backend can, because
it connects as the table owner and checks the signed-in user itself.

**DATABASE_URL vs DIRECT_URL**
- `DATABASE_URL` — used by the running app → **Session pooler** string.
- `DIRECT_URL` — used by `prisma migrate` → normally the **Direct connection** (`db.<ref>.supabase.co`).

> ⚠️ **Change to the usual advice:** Supabase's *direct* host is **IPv6-only**, and **Render cannot reach IPv6**.
> On Render, set **DIRECT_URL to the same Session pooler string**. The session pooler supports
> everything migrations need, so this is safe.

**Migration commands**

```bash
cd backend
npx prisma migrate dev --name <change>   # on your PC, after editing schema.prisma: creates a new migration
npx prisma migrate deploy                # applies committed migrations (Render runs this at every start)
npx prisma studio                        # browse the data in your browser
```

To run the first migration against Supabase from your PC, put the Supabase strings in `backend/.env`
and run `npx prisma migrate deploy`. You don't have to, because Render does it on its first start.

---

## Step 3 — Backend API (NestJS)

| Method & path | Auth | What it does |
|---|---|---|
| `GET /health` | – | `{status, database}`; Render's health check |
| `POST /auth/register` · `POST /auth/login` | – | returns `{accessToken, user}` |
| `GET /auth/me` | ✔ | the signed-in user |
| `GET/POST /projects` · `GET/PATCH/DELETE /projects/:id` | ✔ | projects (only your own; others' return 404) |
| `POST /designs/calculate` | – | calculate without saving (live preview, public calculator) |
| `GET/POST /projects/:projectId/designs` | ✔ | list / save designs |
| `GET/PATCH/DELETE /designs/:id` | ✔ | one design; PATCH recalculates if inputs change |
| `GET /projects/:projectId/export?format=xlsx\|csv` | ✔ | Excel (Summary + Layers sheets) or CSV |
| `GET /dashboard` | ✔ | totals, per-project adequate / not adequate, recent designs |

- **Validation:** every body is a DTO with `class-validator` rules, with the same limits as the notebook
  (reliability 50–99.99 %, m 0.4–1.4, …). Unknown fields are rejected, and errors come back as readable lists.
- **Auth:** bcrypt hashes; JWT signed with `JWT_SECRET`, sent as `Authorization: Bearer <token>`.
- **CORS:** `CORS_ORIGINS` lists the allowed sites; `*` is a wildcard (for Vercel preview URLs).
- **PORT:** read from the environment (Render sets it); defaults to 4000 locally.

**Environment variables** (`backend/.env.example`):

| Variable | Example | Purpose |
|---|---|---|
| `DATABASE_URL` | Supabase session pooler | app's database connection |
| `DIRECT_URL` | same as above on Render | migrations |
| `JWT_SECRET` | 48 random characters | signs sign-in tokens; **keep secret** |
| `JWT_EXPIRES_IN` | `7d` | how long a sign-in lasts |
| `CORS_ORIGINS` | `https://<your-app>.vercel.app,https://<your-app>-*.vercel.app,http://localhost:3000` | sites allowed to call the API |
| `PORT` | `4000` | set by Render automatically |

---

## Step 4 — Frontend (Next.js)

| Page | What you can do |
|---|---|
| `/` | start page; signed-in users go to the dashboard |
| `/register`, `/login` | create an account / sign in |
| `/dashboard` | totals, adequate vs not adequate per project, recent designs |
| `/projects` | list and create projects |
| `/projects/[id]` | the project's designs; Excel/CSV export, rename, delete |
| `/projects/[id]/designs/new` and `/[designId]` | the design editor: inputs on the left, live results on the right; save |
| `/calculator` | public calculator, no account and nothing saved |

**Environment variable:** `NEXT_PUBLIC_API_URL`, the API address (`http://localhost:4000` locally,
`https://<service>.onrender.com` live). It's built into the page code, so **after changing it on Vercel, redeploy**.

Every page has loading and error states. If the free Render server is asleep, the app says so and waits.

---

## Step 5 — Deploy the backend to Render

**Option A, Blueprint (easiest):** Render → **New → Blueprint** → pick your GitHub repo → it reads
`render.yaml` and asks for `DATABASE_URL`, `DIRECT_URL` and `CORS_ORIGINS`. `JWT_SECRET` is generated for you.

**Option B, by hand:** Render → **New → Web Service** → your repo, then:

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Runtime / Language | Node |
| Build Command | `npm ci && npx prisma generate && npm run build` |
| Start Command | `npm run start:render` (= `prisma migrate deploy && node dist/main.js`) |
| Health Check Path | `/health` |
| Instance type | Free |
| Environment | `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN=7d`, `CORS_ORIGINS`, `NODE_VERSION=22` |

**Why this order:** `prisma generate` must run before compiling, because the code imports the generated client.
`prisma migrate deploy` runs at **start**, because the free plan has no "pre-deploy command". Without new
migrations it takes about a second.

Check the deploy: open `https://<service>.onrender.com/health`. It should show `"database":"up"`.

---

## Step 6 — Deploy the frontend to Vercel

1. vercel.com → **Add New → Project** → import the same GitHub repo.
2. **Root Directory:** `frontend`. **Framework Preset:** Next.js (detected automatically). Leave the build settings at their defaults.
3. **Environment Variables:** `NEXT_PUBLIC_API_URL = https://<service>.onrender.com`. Then **Deploy**.
4. Copy your Vercel address (e.g. `https://<your-app>.vercel.app`), go back to **Render → Environment** and set
   `CORS_ORIGINS = https://<your-app>.vercel.app,https://<your-app>-*.vercel.app,http://localhost:3000`
   → **Save**. Render redeploys by itself.

---

## Deployment settings (copy these)

**Render — Web Service (backend)**

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Build Command | `npm ci && npx prisma generate && npm run build` |
| Start Command | `npm run start:render` |
| Health Check Path | `/health` |

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase → Connect → **Session pooler** string (port 5432), with your password |
| `DIRECT_URL` | the **same** Session pooler string |
| `JWT_SECRET` | a long random string (Blueprint generates it) — keep secret |
| `JWT_EXPIRES_IN` | `7d` |
| `CORS_ORIGINS` | your Vercel address(es), comma-separated, e.g. `https://<your-app>.vercel.app,https://<your-app>-*.vercel.app` |
| `NODE_VERSION` | `22` |
| `PORT` | don't set — Render sets it |

**Vercel — Project (frontend)**

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Next.js |
| Build Command | default (`next build`) |
| Output / Start | default (Vercel serves it; `next start` only when self-hosting) |

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | your Render address, e.g. `https://<service>.onrender.com` (no trailing `/`). The build stops with a message if it is missing. |

Order: Supabase project → Render (with a temporary `CORS_ORIGINS=http://localhost:3000`) → Vercel (with the Render
address) → set the real `CORS_ORIGINS` on Render.

---

## Step 7 — Testing and troubleshooting

**End-to-end check of the live app**
1. `https://<service>.onrender.com/health` shows `"status":"ok","database":"up"`.
2. Open the Vercel address → **Create account** → you land on the dashboard.
3. **Projects** → create "Test road" → **New design**. The defaults should show AC 100.2, DBM 163.0,
   base 160.6, subbase 435.3 mm, **ADEQUATE**.
4. Enter your spreadsheet case (R 98, W18 131, *Enter MR*, base 43,500): AC minimum **109.8 mm**, SN1 **1.901**.
5. Save → it appears on the project page and the dashboard → **Export Excel** downloads a file.
6. Sign out → opening `/dashboard` sends you to sign-in.

**Common problems**

| Symptom | Cause | Fix |
|---|---|---|
| Browser console: *blocked by CORS policy* | Vercel address missing from `CORS_ORIGINS` (or a trailing `/`, or `http` vs `https`) | Set the exact address on Render, save, wait for the redeploy |
| "Cannot reach the server…" for about a minute | Render free tier sleeps after 15 min idle; the first request wakes it (~50 s) | Wait and retry; paid plans don't sleep |
| Render log: `P1001: Can't reach database server` | Wrong host or password, or the IPv6 direct host used on Render | Use the **Session pooler** string for both URLs; check the password |
| `prepared statement "s0" already exists` | **Transaction** pooler (port **6543**) used without `?pgbouncer=true` | Use the **Session** pooler (port 5432), or add `?pgbouncer=true` |
| Supabase "project paused" | Free projects pause after about 1 week without use | Supabase dashboard → **Restore**; use it at least weekly |
| Frontend still calls `localhost:4000` live | `NEXT_PUBLIC_API_URL` missing, or changed without a redeploy | Set it on Vercel → **Deployments → Redeploy** |
| `JWT_SECRET is missing or too short` at start | Variable not set on Render | Add it (≥ 16 random characters) |
| `PrismaClientInitializationError … query engine` | Client generated on another OS | Keep `npx prisma generate` in the Build Command (it is) |
| 401 "Your session has expired" | Token older than `JWT_EXPIRES_IN`, or `JWT_SECRET` changed | Sign in again |
| Env variables not loading locally | File not named exactly `backend/.env` / `frontend/.env.local` | Rename; restart `npm run start:dev` / `npm run dev` |

**A design choice to know about:** the sign-in token is kept in the browser's localStorage and sent as a
Bearer header. Cookies are the usual alternative, but the app and API live on different domains
(vercel.app and onrender.com), and browsers increasingly block such cross-site cookies. Use a custom domain
for both before switching to cookies.

---

## How to use the app

1. **Create an account** (or try **Quick calculator** without one).
2. **Projects → New project**: e.g. "Addis–Adama road", location "km 12–18".
3. Open the project → **New design**:
   - **1 Design conditions:** reliability, So, W18 (millions of ESAL), ΔPSI. `3,5` and `3.5` both work.
   - **2 Structure:** tick **DBM** and/or **capping** for a 3-, 4- or 5-layer design.
   - **3 Layer support:** *From CBR* (base, subbase, capping, subgrade) or *Enter MR*. The DBM is asphalt, so its MR
     (default 400,000 psi) is always entered directly.
   - **4 Coefficients:** a1–a5, and m2–m5 (0.4–1.4).
   - **5 Options:** round suggestions up (5/10/25 mm), AASHTO minimum AC/base thickness.
4. Results update as you type. Each thickness box shows the **minimum**; leave it empty or type your own
   (`250`, `25cm`, `10in`). Each layer shows ✅ OK / ❌ NOT OK, and the banner shows **ADEQUATE / NOT ADEQUATE**.
5. Give it a name → **Save design**. Open it later to change it → **Save changes**.
6. The **project page** lists all designs. Use **Export Excel / Export CSV**, or the browser's print to save a PDF.
7. The **dashboard** shows totals and adequate vs not adequate for each project.
