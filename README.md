# Information Management Project

Barangay San Perfecto health information system built with React + Vite and Supabase.

## Tech Stack

- Frontend: React, Vite, React Router, Tailwind, Chart.js
- Backend: Supabase (Postgres, Auth, RLS, Edge Functions)

## Local App Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and set your Supabase values:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=YOUR_SUPABASE_ANON_KEY
```

3. Run frontend:

```bash
npm run dev
```

## Supabase Backend Setup

Backend assets are in [supabase/README.md](supabase/README.md).

Quick steps:

1. Link Supabase project:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

2. Apply normalized schema and RLS policies:

```bash
supabase db push
```

3. Set function secrets and deploy the admin account-creation function:

```bash
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
supabase secrets set SUPABASE_ANON_KEY=YOUR_ANON_KEY
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
supabase secrets set SMS_API_KEY=YOUR_SMS_API_KEY
supabase functions deploy create-health-worker-account
supabase functions deploy auth-otp
supabase functions deploy admin-cleanup-accounts
```

## Included Backend Features

- Normalized relational schema with foreign keys for all major domains
- Supabase Auth with role-aware profile sync trigger (`auth.users` -> app tables)
- JWT-aware role helpers and RLS policies per table
- RPCs for login identifier lookup, booking, consultation completion, inbox creation
- SMS OTP login flow for all roles via Supabase Edge Function and sms mobile API
- Inventory movement model with balance trigger and stock validation
- Analytics views for attendance and top diagnosis by age group
