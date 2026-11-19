# FloodConnect

**Integrated Flood Monitoring, Community Reporting & Emergency Response Coordination Platform**  
*Initial focus: East Godavari District, Andhra Pradesh, India (Rajahmundry, Dowleswaram, Kadiam, Korukonda, Kovvur, Anaparthi, Nidadavole).*

---

## Core Principles & Governance

1. **Human-in-the-Loop Verification**: AI suggestions never verify an incident, auto-merge duplicates, or authorize rescue dispatches. Every record is clearly labeled with one of four origin badges:
   - `Citizen-submitted`
   - `Admin-verified`
   - `Official / Government`
   - `AI-suggested`
2. **No Fabricated Official Data**: FloodConnect never invents rainfall totals, river water levels, or government flood warnings. Unless an authorized Admin manually publishes an official bulletin (with agency source and publication timestamp), the UI explicitly displays: *"Live official data is currently unavailable."*
3. **Point Reports, Not Flood Boundaries**: Unverified citizen reports are never displayed as confirmed flood zones. Public maps display **Admin-verified** point markers and open relief shelters only; authenticated citizens also see their own pending reports.
4. **Citizen Privacy & RBAC**: Public views never expose phone numbers, medical needs, or exact emergency-request coordinates. Role-Based Access Control (`citizen`, `volunteer`, `rescue_team`, `admin`) is enforced both in React (`<ProtectedRoute>`) and PostgreSQL Row Level Security (`supabase/schema.sql`).
5. **Transparent Demo Mode**: When `VITE_DEMO_MODE=true` (or when Supabase credentials are absent), FloodConnect runs on a simulated East Godavari dataset stored in `localStorage` and displays a visible **`SIMULATED DEMO DATA`** badge on every screen.

---

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, React Router v7, Lucide React
- **Maps**: Leaflet + React Leaflet + OpenStreetMap tiles (with proper attribution)
- **Analytics**: Recharts (computed strictly from stored records)
- **Backend-as-a-Service**: Supabase (Auth, PostgreSQL + RLS, Storage, Realtime) via `@supabase/supabase-js`
- **AI Assistance**: `@google/genai` (`gemini-4-hydrogen`) routed exclusively through `src/services/aiService.js` with deterministic rule-based fallback (`"AI unavailable, using basic rules"`)

---

## Local Installation & Commands

### Prerequisites
- Node.js **18+** (20 LTS recommended)
- npm **9+**

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local` and adjust values:
```bash
cp .env.example .env.local
```

Key variables (see [`.env.example`](./.env.example)):
| Variable | Required? | Purpose |
| --- | --- | --- |
| `VITE_DEMO_MODE` | Yes (`true` or `false`) | Switches between simulated Demo Mode and real Supabase mode |
| `VITE_SUPABASE_URL` | Real mode only | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Real mode only | Supabase public `anon` key (**never** `service_role`) |
| `VITE_GEMINI_API_KEY` | Optional | Enables Gemini AI features via `src/services/aiService.js` (falls back to basic rules if omitted) |
| `VITE_AI_BACKEND_URL` | Optional (Future) | Points `aiService.js` to the future Python FastAPI proxy on Render |

### 3. Run Development Server
```bash
npm run dev
```
The app runs at `http://localhost:3000`.

### 4. Type-Check & Production Build
```bash
npm run lint
npm run build
npm run preview
```

---

## Switching Between Demo Mode and Real Supabase Mode

FloodConnect routes all data operations through a single abstraction layer (`src/services/dataService.js`) with two interchangeable implementations:
- `src/services/demoDataLayer.js` — simulated East Godavari dataset persisted in browser `localStorage`
- `src/services/supabaseDataLayer.js` — live Supabase PostgreSQL, Auth, Storage, and Realtime

| Mode | `.env.local` Setting | Behavior |
| --- | --- | --- |
| **Simulated Demo Mode** | `VITE_DEMO_MODE="true"` | Works immediately with zero external accounts. Shows quick-fill Demo accounts (Citizen, Volunteer, Rescue Team, District Admin) and `SIMULATED DEMO DATA` badges. |
| **Real Supabase Mode** | `VITE_DEMO_MODE="false"` + `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | Uses real Supabase Auth, RLS-protected PostgreSQL tables, Storage bucket uploads, and Realtime notifications. If Supabase variables are missing, the app displays a transparent configuration banner naming the missing variables and falls back safely. |

---

## Supabase Setup Steps (Real Mode)

Full SQL details are also documented in [`supabase/README_SETUP.md`](./supabase/README_SETUP.md).

1. **Create a Supabase Project** at [supabase.com](https://supabase.com).
2. **Run the Database Schema**:
   - Open **SQL Editor** in your Supabase Dashboard.
   - Paste and execute the entire contents of [`supabase/schema.sql`](./supabase/schema.sql).
   - This creates all tables (`profiles`, `incidents`, `incident_verification_history`, `emergency_requests`, `rescue_teams`, `rescue_assignments`, `rescue_status_history`, `volunteers`, `volunteer_tasks`, `alerts`, `shelters`, `notifications`, `official_information`, `contact_inquiries`), triggers, RLS policies, and the `incident-photos` Storage bucket policies.
3. **Verify Storage Bucket**:
   - Under **Storage**, verify the `incident-photos` bucket exists (or create it as a public-read bucket with authenticated upload policies, 5 MB file size limit, and allowed MIME types `image/jpeg`, `image/png`, `image/webp`).
4. **Enable Realtime**:
   - Ensure `notifications` is enabled in **Database → Replication → supabase_realtime** (included at the bottom of `supabase/schema.sql`).
5. **Configure Auth URLs**:
   - In **Authentication → URL Configuration**, set **Site URL** to your local or Vercel URL and add `/reset-password` to **Redirect URLs**.
6. **Promote Your First District Admin**:
   - Self-registration only allows `citizen` or `volunteer` (pending approval).
   - Register your admin account via `/register`, then run once in the Supabase SQL Editor:
     ```sql
     update public.profiles
     set role = 'admin', updated_at = now()
     where email = 'your-admin@example.com';
     ```
   - From that point forward, promote Rescue Team leads and Admins directly inside **Admin Dashboard → Users & Roles**.
7. **Update `.env.local`**:
   - Set `VITE_DEMO_MODE="false"`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`, then restart `npm run dev`.

---

## Vercel Deployment Steps

FloodConnect is a Vite React SPA ready for zero-config deployment on **Vercel** (an SPA rewrite configuration is included in [`vercel.json`](./vercel.json)).

1. **Push Repository** to GitHub, GitLab, or Bitbucket.
2. **Import Project in Vercel**:
   - Open [vercel.com/new](https://vercel.com/new) and import your FloodConnect repository.
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. **Add Environment Variables** in **Project Settings → Environment Variables**:
   - `VITE_DEMO_MODE`: `"false"` (for production Supabase) or `"true"` (for public demo deployment)
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase `anon` key (**never** `service_role`)
   - `VITE_AI_BACKEND_URL`: Your Render FastAPI URL once deployed *(recommended for production instead of exposing `VITE_GEMINI_API_KEY` in the browser)*
   - *(Optional for demo-only)* `VITE_GEMINI_API_KEY`: Only if testing direct browser AI before deploying the FastAPI proxy
4. **Configure Supabase Auth Redirects**:
   - Add your deployed Vercel URL (e.g., `https://floodconnect.vercel.app` and `https://floodconnect.vercel.app/reset-password`) to Supabase **Authentication → URL Configuration**.
5. **Deploy & Verify**:
   - Click **Deploy**. Confirm direct navigation to deep routes (such as `/map`, `/official-info`, `/login`) resolves cleanly via `vercel.json`.

---

## Security & Hardening Summary (Stage 6)

- **Input Sanitization & Validation** (`src/utils/validation.js` & `src/services/dataService.js`): Strips HTML/script payloads and unsafe control characters while preserving English and Telugu Unicode text; enforces coordinate bounds, phone validation, household count invariants, and future-date checks.
- **Strict Image Upload Checks** (`src/components/common/PhotoUploadField.jsx`): Enforces JPEG/PNG/WebP allowlist, file extension match, **5 MB** limit, and **binary magic-byte signature verification** (`FF D8 FF`, `89 50 4E 47`, `RIFF....WEBP`) so renamed non-image files are rejected.
- **Error Boundaries** (`src/components/common/ErrorBoundary.jsx`): Wraps root routing, layout views, and Leaflet maps; always keeps India emergency helplines (`112`, `108`, `101`, `1077`) visible during recovery.
- **Submission Rate-Limit / Cooldown** (`src/utils/rateLimiter.js`, `src/hooks/useSubmissionCooldown.js`): Persistent `localStorage` cooldown & burst guard on public coordination inquiries (60s cooldown / 3 per 15m), flood incident reports (45s cooldown / 5 per 10m), and emergency requests (30s cooldown / 3 per 10m with direct 112/108/101 guidance).
- **Accessibility & Mobile Responsiveness**: Skip-to-main-content links, high-contrast `:focus-visible` keyboard outlines, Escape-key dismissal on drawers & modals, ARIA landmarks/labels/live regions, WCAG AA badge contrast, touch-friendly tap targets, and horizontal-overflow protection.

---

## Manual End-to-End Testing Checklist

Run through this checklist in **Demo Mode** (using the built-in role quick-switchers on `/login`) and again in **Real Supabase Mode** before production launch:

### Part A: Full End-to-End Emergency Lifecycle
- [ ] **1. Citizen Reports Flood Incident**
  - Sign in as **Citizen** → go to **Report Incident** (`/dashboard/citizen/report`).
  - Enter headline & East Godavari description → click **AI Suggest Category & Urgency** → verify `AI-suggested` badge, **`Human review required: Yes`**, and `"AI unavailable, using basic rules"` notice if `VITE_GEMINI_API_KEY` is unset.
  - Test validation: try submitting empty fields, try uploading a non-image or >5 MB file (must reject with clear error).
  - Capture GPS or click on the Leaflet picker map, upload a valid JPEG/PNG/WebP photo (<5 MB), and submit.
  - Confirm unique `INC-YYYYMMDD-XXXX` ID, status **`Pending Verification`**, and submission cooldown timer activates.
  - Confirm report appears in **My Reports** and as a dashed pending pin on the Citizen Map—and is **NOT** visible on the logged-out Public Map (`/map`).
- [ ] **2. Admin Verifies Incident & Checks Duplicates**
  - Sign in as **District Admin** → open **Incidents** (`/dashboard/admin/incidents`).
  - Click **AI Triage & Duplicates** on the citizen's report → inspect classification, keywords, and duplicate match scores (Haversine distance + time window + category + text similarity); confirm nothing is auto-merged or auto-verified.
  - Click **Verify**, set Reviewed Priority, add an audit note, and confirm.
  - Confirm status becomes **`Admin-verified`**, entry appears in **Audit History**, citizen receives a verification notification, and the marker now appears on the Public Map (`/map`).
- [ ] **3. Citizen Submits Private Emergency Request**
  - Sign in as **Citizen** → open **Emergency Help** (`/dashboard/citizen/emergency`).
  - Verify red disclaimer banner (*"Submission does not guarantee immediate rescue"*) and official helplines (`112`, `108`, `101`, `1077`).
  - Fill household count, children/elderly, medical/accessibility needs, check **People currently trapped**, and click **AI Priority Suggestion** to verify advisory priority preview.
  - Acknowledge disclaimer and submit → confirm unique `ER-YYYYMMDD-XXXX` ID and 6-step status tracker at **Pending**.
  - Verify the request is **never** shown on `/map` or any public page.
- [ ] **4. Admin Reviews & Assigns Rescue Team**
  - Sign in as **District Admin** → open **Emergencies** (`/dashboard/admin/emergencies`).
  - Click **AI Priority Suggestion** → inspect risk factors & rationale (`AI-suggested`, `Human review required: Yes`).
  - Select an available East Godavari Rescue Team, set status to **Assigned**, add a dispatch note, and click **Save Dispatch & Status**.
  - Confirm citizen receives an assignment notification and `rescue_status_history` logs the transition.
- [ ] **5. Rescue Team Updates Field Progress**
  - Sign in as **Rescue Team** → open **Assigned Requests** (`/dashboard/rescue`).
  - Verify only requests assigned to this team appear, with protected phone, medical info, and exact map coordinates.
  - Test **Translate to Telugu (తెలుగు)** on the description → verify original text remains visible alongside translation.
  - Click **Accept & Mark En Route**, add a field progress note, then click **Update: On Site / Rescue In Progress**.
- [ ] **6. Citizen Notified in Real Time**
  - Sign in as **Citizen** → open the top-bar **Notification Bell** and `/notifications`.
  - Confirm notifications exist for incident verification, team assignment, and rescue progress updates; test **Mark Read** and **Mark All Read**.
- [ ] **7. Rescue Team Marks Resolved (With Confirmation)**
  - Sign in as **Rescue Team** → click **Mark Resolved** → verify Confirmation Dialog opens (test Escape key & Cancel, then Confirm).
  - Confirm status transitions to **Resolved**, citizen receives resolution notification, and Admin **Analytics** (`/dashboard/admin/analytics`) updates resolution metrics from real records.

### Part B: Official Info, AI Area Summary, Accessibility & Mobile
- [ ] **Official Information (`/official-info` & `/dashboard/admin/official-info`)**: Confirm `"Live official data is currently unavailable."` shows for Rainfall/Forecasts/River Levels until an Admin manually publishes an entry with agency source and publication time.
- [ ] **Admin Area Summary**: On Admin Incidents or Admin Analytics, choose a locality (e.g., *Dowleswaram* and a locality with 0 reports) → click **Generate Area Summary** → confirm only real stored record codes are cited and 0-report areas never invent incidents.
- [ ] **Keyboard & Accessibility**: Press `Tab` from page load to confirm **Skip to main content** appears, focus outlines are clearly visible on light and dark navy backgrounds, and `Escape` closes mobile menus and dialogs.
- [ ] **Mobile Responsiveness**: Test at `375px` width (Landing, Public Map, Report Form, Emergency Form, Admin Portal, Rescue Portal) — confirm zero horizontal scrollbars, readable cards, and responsive sidebar/drawer navigation.

---

## Future Backend Architecture (Python FastAPI + Render)

A Python FastAPI backend is intentionally deferred to a future stage. All Gemini API calls are isolated inside `src/services/aiService.js` so switching to a production server-side proxy requires changing **only** `VITE_AI_BACKEND_URL` (or `AI_CONFIG.endpointBaseUrl`).

See the full architecture, endpoint schemas (`/classify`, `/duplicates`, `/priority`, `/translate`, `/summarize-area`), and Render deployment plan in **[`docs/FUTURE_BACKEND.md`](./docs/FUTURE_BACKEND.md)**.
