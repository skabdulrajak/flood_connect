# FloodConnect Firestore Security Specification

## 1. Roles & Authorization Model
- **Unauthenticated**: Zero access to any collection (`allow read, write: if false;` default deny). FloodConnect enforces a mandatory authentication gate.
- **Citizen (`role == 'citizen'`)**:
  - Read/create/update own `/users/{uid}` (cannot self-promote `role` above `'citizen'` or `'volunteer'`).
  - Read/create/delete own `/users/{uid}/chat_messages/{messageId}`.
  - Read verified `/incidents`, read own pending `/incidents`, create `/incidents` with `status == 'pending_verification'` and `reporter_id == request.auth.uid`.
  - Read/create/cancel own `/emergency_requests` (`requester_id == request.auth.uid`).
  - Read `/shelters`, `/alerts`, `/official_info`.
  - Read/mark-read own `/notifications` (`user_id == request.auth.uid`).
- **Volunteer (`role == 'volunteer'`)**:
  - Citizen permissions + read/update own `/volunteers/{uid}` availability (cannot self-approve `approval_status`) + read/update assigned `/volunteer_tasks` (`assigned_user_id == request.auth.uid`).
- **Rescue Team (`role == 'rescue_team'`)**:
  - Citizen permissions + read/update `/emergency_requests` assigned to them (`assigned_responder_id == request.auth.uid`) + read/update `/rescue_teams` where `leader_user_id == request.auth.uid` + append `/audit_history` entries with `changed_by == request.auth.uid`.
- **Admin (`isAdmin()`)**:
  - Determined by `exists(/databases/$(database)/documents/admins/$(request.auth.uid))` OR bootstrapped admin email `request.auth.token.email == 'rajaksk319@gmail.com' && request.auth.token.email_verified == true`.
  - Full verified administrative management over incidents, emergency requests, shelters, alerts, rescue teams, volunteers, volunteer tasks, official info, notifications, user roles, and audit history.

## 2. PII Protection & Data Integrity
- `/users/{userId}` and `/emergency_requests/{requestId}` contain phone numbers and names; strictly isolated so citizens can never list or read other citizens' profiles or rescue contact numbers.
- Self-registration never allows choosing `admin` or `rescue_team`.
- `incidents` created by non-admins MUST start with `status == 'pending_verification'`.
- `audit_history` is append-only (no client updates or deletes).
- All writes validate required fields, allowed key sets (`hasOnly`), string length caps, and numeric ranges.
