# FloodConnect — Supabase Setup & Configuration Guide

This guide walks you through connecting FloodConnect to your own Supabase project (Auth, PostgreSQL, Storage, and Realtime). Until these variables are configured, FloodConnect transparently falls back to **Demo Mode** (`VITE_DEMO_MODE=true`) using simulated East Godavari data stored locally in your browser.

---

## 1. Create a Supabase Project

1. Sign in to [Supabase](https://supabase.com) and create a new project (recommended region: **South Asia / Mumbai `ap-south-1`** for lowest latency to Andhra Pradesh).
2. Wait for the database to finish provisioning.
3. Navigate to **Project Settings -> API** and copy:
   - **Project URL** (`VITE_SUPABASE_URL`)
   - **anon / public key** (`VITE_SUPABASE_ANON_KEY`)

> **Security Warning:** Never place your Supabase `service_role` key in any frontend `.env` variable (`VITE_*`). All access control in FloodConnect is enforced via Row Level Security (RLS) using the public `anon` key and authenticated user JWTs.

---

## 2. Run the Database Schema

1. In your Supabase dashboard, open **SQL Editor -> New query**.
2. Copy the entire contents of `/supabase/schema.sql` and run it.
3. Verify the execution completes without errors. This automatically creates:
   - All **12 tables** (`profiles`, `incidents`, `emergency_requests`, `rescue_teams`, `rescue_assignments`, `volunteers`, `volunteer_tasks`, `alerts`, `shelters`, `notifications`, `incident_verification_history`, `rescue_status_history`)
   - Human-readable ID generators (`INC-YYYYMMDD-XXXX` and `ER-YYYYMMDD-XXXX`)
   - Auto-profile trigger forcing every new signup to `role = 'citizen'`
   - Self-role-escalation guard blocking non-admin updates to `role` or `volunteer_status`
   - Audit trail triggers for incident verification and rescue status transitions
   - Strict **Row Level Security (RLS)** across every table
   - Storage bucket `incident-photos` (5 MB max, JPEG/PNG/WebP only)
   - **Realtime** replication on `incidents`, `emergency_requests`, `alerts`, and `notifications`

---

## 3. Configure Authentication URLs

1. Go to **Authentication -> URL Configuration** in Supabase.
2. Set **Site URL** to your deployed app URL (or `http://localhost:3000` for local development).
3. Add the password reset callback URL to **Redirect URLs**:
   - `http://localhost:3000/reset-password`
   - `https://<your-production-domain>/reset-password`

---

## 4. Configure Environment Variables

Create a `.env.local` file in the project root (or set environment variables in your hosting provider):

```env
VITE_DEMO_MODE="false"
VITE_SUPABASE_URL="https://YOUR-PROJECT-REF.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR-PUBLIC-ANON-KEY"
VITE_GEMINI_API_KEY=""
```

Restart the development server after changing environment variables.

---

## 5. Promote Your First District Admin & Rescue Team Accounts

Because self-registration is locked strictly to `citizen` (or `volunteer` pending admin approval), promote your initial administrator account directly in the Supabase SQL Editor after registering via `/register`:

```sql
-- 1. Promote an initial District Admin
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin@eastgodavari.gov.in';

-- 2. Assign a Rescue Team Lead (or do this inside the Admin Dashboard)
UPDATE public.profiles
SET role = 'rescue_team'
WHERE email = 'boatunit1@eastgodavari.gov.in';
```

Once at least one `admin` exists, all future volunteer approvals and role assignments can be performed inside the FloodConnect Admin Dashboard.

---

## 6. Future FastAPI AI Backend Migration

All AI features are isolated inside `src/services/aiService.js`. When your Python FastAPI backend is ready:
1. Set `VITE_AI_BACKEND_URL="https://api.your-floodconnect-backend.org"` in your environment.
2. Keep your Gemini API key strictly on the FastAPI server and leave `VITE_GEMINI_API_KEY` empty on the frontend.
