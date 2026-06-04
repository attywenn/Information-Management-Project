AGENTS.md — Developer / AI Agent Guide

Purpose
- Short guidance for AI coding agents working in this repository: how to run, key files to inspect, conventions, and safety cautions.

Quick commands
- Install: `npm install`
- Dev server: `npm run dev` (Vite)
- Build: `npm run build`
- Lint: `npm run lint`
- Preview build: `npm run preview`

Environment & Supabase
- Copy and populate environment from [.env.example](.env.example) — must set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`.
- Supabase local setup (when changing migrations or functions):
  - `supabase login`
  - `supabase link --project-ref <PROJECT_REF>`
  - `supabase db push`
  - `supabase functions deploy <function-name>`

What to open first
- [package.json](package.json) — scripts and deps
- [src/App.jsx](src/App.jsx) — routing and entry points
- [src/context/AuthContext.jsx](src/context/AuthContext.jsx) — auth pattern
- [src/utils/supabase.js](src/utils/supabase.js) — Supabase client
- [src/services/supabaseBackendService.js](src/services/supabaseBackendService.js) — API layer
- [supabase/README.md](supabase/README.md) — backend requirements
- [supabase/migrations/20260412_000001_core_backend.sql](supabase/migrations/20260412_000001_core_backend.sql) — schema & RLS

Conventions and cautions
- Component files use PascalCase (e.g., `HealthWorkerAccountManagement.jsx`).
- Hooks use `useX` naming and live in `src/context` or `src/hooks`.
- Auth roles: `patient`, `health_worker`, `admin`. RLS is in effect — avoid schema changes without database review.
- Do NOT modify migrations under `supabase/migrations` without coordinating with the database owner; prefer adding new migration files.
- When implementing backend changes, update edge functions in `supabase/functions` and deploy via the Supabase CLI.

Agent behavior recommendations
- Run `npm run lint` before producing PRs. Keep changes minimal and focused.
- If a change touches authentication, RLS, or migrations, call out the required DB migrations and required secrets.
- When unsure about supabase secrets or project-ref, ask for them rather than guessing.
- Link to existing docs rather than duplicating long sections (see links above).

Files added/updated by agents
- Prefer adding new files under appropriate folders and updating `README.md` or `supabase/README.md` with cross-references. Avoid changing historical migration SQL files.

If you need more targeted agent instructions (frontend/backend/testing), request creation of a specialized instruction file.
