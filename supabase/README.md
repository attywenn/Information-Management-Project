# Supabase Backend Setup

This repository now contains a normalized PostgreSQL backend for all roles (patient, health worker, admin) using Supabase Auth, JWT-aware RLS policies, foreign keys, and analytics views.

## Included Backend Artifacts

- Migration: `supabase/migrations/20260412_000001_core_backend.sql`
- Edge Function: `supabase/functions/create-health-worker-account/index.ts`
- Edge Function: `supabase/functions/auth-otp/index.ts`
- Edge Function: `supabase/functions/admin-cleanup-accounts/index.ts`
- Edge Function: `supabase/functions/send-medical-certificate/index.ts`

## Database Design Summary

The schema is normalized and role-split:

- `profiles` (base identity linked to `auth.users`)
- `patient_profiles`, `health_worker_profiles`, `admin_profiles` (role-specific data)
- `addresses`, `security_questions`, `user_security_answers` (lookup and relational profile data)
- `appointments`, `appointment_symptoms`, `consultations`, `consultation_items`
- `inventory_items`, `inventory_balances`, `inventory_movements`
- `messages`, `message_recipients`

Views:

- `v_daily_consultation_attendance`
- `v_top_diagnosis_by_age_group`

Key RPC functions:

- `lookup_login_identity`
- `get_my_profile_bundle`
- `book_appointment`
- `complete_consultation`
- `create_inbox_message`

## Security

- Row-Level Security enabled and forced on core domain tables.
- Policies use `auth.uid()` plus `current_user_role()` helper.
- `current_user_role()` reads role from JWT `app_metadata` and falls back to `profiles.role`.
- Auth trigger syncs `auth.users` into normalized tables.

## Prerequisites

1. Install Supabase CLI.
2. Login and link your project.

## Apply Database Migration

Run from project root:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

## Deploy Edge Function

Set required secrets:

```bash
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
supabase secrets set SUPABASE_ANON_KEY=YOUR_ANON_KEY
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
supabase secrets set SMS_API_KEY=YOUR_SMS_API_KEY
supabase secrets set RESEND_API_KEY=YOUR_RESEND_API_KEY
supabase secrets set RESEND_FROM_EMAIL=San Perfecto Health Center <no-reply@yourdomain.com>
```

Deploy:

```bash
supabase functions deploy create-health-worker-account
supabase functions deploy auth-otp
supabase functions deploy admin-cleanup-accounts
supabase functions deploy send-medical-certificate
```

## Bootstrap Admin Account

Create your first admin in Supabase Auth dashboard or via script and set:

- `app_metadata.app_role = "admin"`
- `user_metadata` fields if needed (`username`, `admin_code`, `pin_code`)

The database trigger will create related rows in `profiles` and `admin_profiles`.

## Frontend Environment Variables

Use these in your frontend `.env`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `SMS_API_KEY` is required only inside Supabase Edge Function secrets, not the frontend.
- `RESEND_API_KEY` is required only inside Supabase Edge Function secrets, not the frontend.
- `RESEND_FROM_EMAIL` is optional and should be a verified sender for production.

If using direct function calls from frontend, call:

- `POST {VITE_SUPABASE_URL}/functions/v1/create-health-worker-account`
- `POST {VITE_SUPABASE_URL}/functions/v1/auth-otp`
- `POST {VITE_SUPABASE_URL}/functions/v1/admin-cleanup-accounts`

with `Authorization: Bearer <access_token>` from logged-in admin.

## Notes

- Existing localStorage UI code can be migrated progressively to Supabase RPC/table operations.
- This backend is ready for production hardening with audit logs and stricter admin-only write workflows.
