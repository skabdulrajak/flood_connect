# FloodConnect Future Backend Plan (Python FastAPI + Render)

> **Status**: Planned future stage (not deployed yet).  
> The current frontend routes all AI operations exclusively through [`src/services/aiService.js`](../src/services/aiService.js) so moving to this backend requires changing **one environment variable** (`VITE_AI_BACKEND_URL`) with zero page refactoring.

---

## 1. Why Move AI Calls to a Backend Proxy in Production?

In development/demo builds, `src/services/aiService.js` can call the Gemini API directly using `VITE_GEMINI_API_KEY` (with automatic rule-based fallback when missing). In production, browser-side API keys are visible in client network requests and compiled bundles.

Moving AI endpoints into a Python FastAPI service provides:
1. **Secret Protection**: `GEMINI_API_KEY` lives strictly on the server (Render environment secret) and is never sent to browsers.
2. **Auth & Role Verification**: FastAPI verifies the caller's Supabase JWT (`Authorization: Bearer <access_token>`) and restricts admin-only endpoints (`/duplicates`, `/summarize-area`).
3. **Server-Side Rate Limiting**: Protects AI quotas with per-user/IP rate limits (e.g., `slowapi` + Redis or in-memory limiter).
4. **Governance Enforcement**: Enforces `origin: "ai_suggested"`, `humanReviewRequired: "Yes"`, PII redaction (stripping phone numbers/names before LLM prompts), and deterministic rule fallback if Gemini is unreachable.
5. **Future Extensions**: Enables scheduled ingestion of official IMD/CWC hydrological feeds (replacing manual-only official entries once authorized government APIs are available) and FCM push notification relays.

---

## 2. Single-Config Frontend Cutover

In [`src/services/aiService.js`](../src/services/aiService.js):
```js
export const AI_CONFIG = {
  endpointBaseUrl: envConfig.aiBackendUrl || null,
  model: 'gemini-4-hydrogen',
};
```
When `VITE_AI_BACKEND_URL="https://floodconnect-ai.onrender.com"` is set in Vercel:
- Leave `VITE_GEMINI_API_KEY` **blank** in Vercel.
- All frontend calls automatically POST JSON to:
  - `${VITE_AI_BACKEND_URL}/classify`
  - `${VITE_AI_BACKEND_URL}/duplicates`
  - `${VITE_AI_BACKEND_URL}/priority`
  - `${VITE_AI_BACKEND_URL}/translate`
  - `${VITE_AI_BACKEND_URL}/summarize-area`
- If the backend is unreachable or times out, `aiService.js` transparently falls back to deterministic local rules and displays `"AI unavailable, using basic rules"`.

---

## 3. Proposed FastAPI Directory Layout

```text
floodconnect-backend/
├── app/
│   ├── main.py                # FastAPI app, CORS, rate-limit middleware, /health
│   ├── config.py              # Pydantic Settings (GEMINI_API_KEY, SUPABASE_JWT_SECRET, ALLOWED_ORIGINS)
│   ├── auth.py                # Supabase JWT validation & role guard helpers
│   ├── schemas.py             # Pydantic request & response contracts
│   ├── services/
│   │   ├── gemini_client.py   # google-genai SDK wrapper (gemini-4-hydrogen)
│   │   ├── rules_fallback.py  # Deterministic keyword, Haversine, priority & glossary fallbacks
│   │   └── pii_scrubber.py    # Strips phone numbers/emails before LLM prompts
│   └── routers/
│       ├── classify.py        # POST /classify
│       ├── duplicates.py      # POST /duplicates
│       ├── priority.py        # POST /priority
│       ├── translate.py       # POST /translate
│       └── summary.py         # POST /summarize-area
├── requirements.txt
├── render.yaml
└── .env.example
```

---

## 4. FastAPI Endpoint Contracts

All AI responses MUST include `"origin": "ai_suggested"` and `"humanReviewRequired": "Yes"`. None of these endpoints write directly to `incidents.status = 'verified'` or delete/merge database records.

### 4.1 `POST /classify` — Incident Classification
Classifies a flood incident draft or submitted report.

- **Auth**: Authenticated user (`citizen`, `volunteer`, `rescue_team`, `admin`)
- **Rate Limit**: `15 requests / minute / user`
- **Request JSON**:
  ```json
  {
    "title": "Knee-deep water blocking Dowleswaram culvert",
    "description": "Water entered 6 ground-floor houses near Ward 4 after heavy rain.",
    "locality": "Dowleswaram",
    "location_text": "Barrage Road Ward 4"
  }
  ```
- **Response JSON**:
  ```json
  {
    "origin": "ai_suggested",
    "usedFallback": false,
    "fallbackNotice": "",
    "suggestedCategory": "residential_flooding",
    "suggestedUrgency": "high",
    "keywords": ["knee-deep", "ground-floor houses", "culvert", "Ward 4"],
    "shortSummary": "Residential flooding with knee-deep water affecting ground-floor homes near Barrage Road Ward 4, Dowleswaram.",
    "humanReviewRequired": "Yes",
    "disclaimer": "AI-suggested classification only. Human District Admin review is required."
  }
  ```

### 4.2 `POST /duplicates` — Duplicate Incident Scoring
Evaluates possible duplicate candidates using Haversine distance, time gap, category match, token similarity, and optional Gemini semantic comparison notes. Never auto-merges or deletes.

- **Auth**: `admin` role only
- **Rate Limit**: `20 requests / minute / user`
- **Request JSON**:
  ```json
  {
    "targetIncident": {
      "incident_code": "INC-20261118-0012",
      "title": "Bridge approach submerged near Kadiam",
      "description": "Culvert overflowing and blocking two-wheelers",
      "category": "bridge_blockage",
      "locality": "Kadiam",
      "latitude": 16.9212,
      "longitude": 81.8321,
      "observed_at": "2026-11-18T10:15:00Z"
    },
    "candidates": [
      {
        "incidentId": "uuid-2",
        "incidentCode": "INC-20261118-0009",
        "score": 82,
        "distanceKm": 0.42,
        "timeDiffHours": 1.3,
        "sameCategory": true,
        "textSimilarityPct": 58
      }
    ]
  }
  ```
- **Response JSON**:
  ```json
  {
    "origin": "ai_suggested",
    "usedFallback": false,
    "fallbackNotice": "",
    "matches": [
      {
        "incidentId": "uuid-2",
        "incidentCode": "INC-20261118-0009",
        "score": 82,
        "distanceKm": 0.42,
        "timeDiffHours": 1.3,
        "sameCategory": true,
        "textSimilarityPct": 58,
        "aiNote": "Both reports describe culvert blockage near Kadiam within 0.5 km and 90 minutes."
      }
    ],
    "humanReviewRequired": "Yes",
    "disclaimer": "Advisory duplicate scores only. Reports are never auto-merged or deleted."
  }
  ```

### 4.3 `POST /priority` — Emergency Priority Suggestion
Suggests an advisory triage priority (`low` | `medium` | `high` | `critical`) from structured vulnerability parameters (PII like requester name & phone MUST NOT be sent).

- **Auth**: Authenticated user (`citizen` preview or `admin` triage)
- **Rate Limit**: `15 requests / minute / user`
- **Request JSON**:
  ```json
  {
    "people_count": 5,
    "children_count": 2,
    "elderly_count": 1,
    "medical_needs": "Elderly resident requires insulin",
    "accessibility_needs": "Wheelchair user on ground floor",
    "is_trapped": true,
    "locality": "Dowleswaram",
    "description": "Water rising above doorstep; family moved to terrace."
  }
  ```
- **Response JSON**:
  ```json
  {
    "origin": "ai_suggested",
    "usedFallback": false,
    "fallbackNotice": "",
    "suggestedPriority": "critical",
    "rationale": "Critical priority suggested due to trapped residents, rising water, insulin medical dependency, mobility needs, and vulnerable children/elderly.",
    "riskFactors": [
      "Trapped or stranded status indicated",
      "Critical medical need (insulin)",
      "Wheelchair mobility support required",
      "Vulnerable residents (2 children, 1 elderly)"
    ],
    "humanReviewRequired": "Yes",
    "disclaimer": "Advisory triage priority only. District Control Room admins make final dispatch decisions."
  }
  ```

### 4.4 `POST /translate` — On-Demand Telugu / English Translation
Translates incident descriptions, emergency notes, advisories, and summaries between Telugu (`te`) and English (`en`) while always returning `originalText` intact.

- **Auth**: Authenticated user
- **Rate Limit**: `30 requests / minute / user`
- **Request JSON**:
  ```json
  {
    "text": "Waterlogging blocking culvert near Kadiam nursery junction.",
    "targetLanguage": "te"
  }
  ```
- **Response JSON**:
  ```json
  {
    "origin": "ai_suggested",
    "usedFallback": false,
    "fallbackNotice": "",
    "originalText": "Waterlogging blocking culvert near Kadiam nursery junction.",
    "translatedText": "కడియం నర్సరీ జంక్షన్ సమీపంలోని కల్వర్టు వద్ద నీరు నిలిచి రాకపోకలకు అంతరాయం ఏర్పడింది.",
    "targetLanguage": "te",
    "targetLanguageLabel": "Telugu (తెలుగు)",
    "humanReviewRequired": "Yes"
  }
  ```

### 4.5 `POST /summarize-area` — Grounded Admin Area Summary
Summarizes strictly the real stored incident/emergency records passed for a selected East Godavari locality. Returns a deterministic 0-report statement whenever the input arrays are empty.

- **Auth**: `admin` role only
- **Rate Limit**: `10 requests / minute / user`

### 4.6 `GET /health` — Service Health Probe
Returns `200 OK` (`{"status": "ok", "aiConfigured": true}`) for Render zero-downtime health checks.

---

## 5. Render Deployment Outline

### Step 1: Dependencies (`requirements.txt`)
```text
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
pydantic>=2.9.0
pydantic-settings>=2.6.0
google-genai>=1.0.0
PyJWT>=2.9.0
slowapi>=0.1.9
httpx>=0.27.0
```

### Step 2: Infrastructure Blueprint (`render.yaml`)
```yaml
services:
  - type: web
    name: floodconnect-ai-api
    runtime: python
    region: singapore
    plan: free
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    healthCheckPath: /health
    envVars:
      - key: PYTHON_VERSION
        value: 3.12.7
      - key: GEMINI_API_KEY
        sync: false
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_JWT_SECRET
        sync: false
      - key: ALLOWED_ORIGINS
        value: https://your-floodconnect-app.vercel.app
```

### Step 3: Deploy on Render Dashboard
1. Push `floodconnect-backend/` to a GitHub repository.
2. In Render Dashboard, select **New → Web Service** (or **New → Blueprint** using `render.yaml`).
3. Choose region **Singapore** (lowest latency for Andhra Pradesh / East Godavari users).
4. Set **Build Command**: `pip install -r requirements.txt`
5. Set **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Set **Health Check Path**: `/health`
7. Configure secret environment variables in Render (**Environment** tab):
   - `GEMINI_API_KEY` — Google AI Studio / Gemini server key
   - `SUPABASE_URL` — Supabase project URL
   - `SUPABASE_JWT_SECRET` — From Supabase **Project Settings → API → JWT Settings**
   - `ALLOWED_ORIGINS` — Exact Vercel production URL (never `*` in production)
8. Deploy and verify `GET https://<your-service>.onrender.com/health` returns `200 OK`.

### Step 4: Connect Vercel Frontend to Render Backend
1. Open Vercel **Project Settings → Environment Variables**.
2. Set `VITE_AI_BACKEND_URL` to `https://<your-service>.onrender.com`.
3. Remove `VITE_GEMINI_API_KEY` from Vercel production environment variables.
4. Redeploy Vercel — all AI features now run securely through FastAPI with zero client-side key exposure.
