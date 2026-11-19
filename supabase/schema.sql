-- =============================================================================
-- FloodConnect PostgreSQL / Supabase Database Schema
-- Target Region: East Godavari District, Andhra Pradesh, India
-- Version: Stage 1 Production Baseline
-- =============================================================================
-- Run this entire script in the Supabase SQL Editor (https://app.supabase.com).
-- It creates all 12 core tables, human-readable ID generators, constraints,
-- indexes, RBAC triggers, audit history triggers, Row Level Security (RLS)
-- policies, Storage bucket rules, and Realtime publication settings.
-- =============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Utility Trigger Functions (updated_at)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 3. Human-Readable Code Generators (INC-YYYYMMDD-XXXX and ER-YYYYMMDD-XXXX)
CREATE SEQUENCE IF NOT EXISTS public.incident_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.emergency_code_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_incident_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  seq_num INTEGER;
BEGIN
  IF NEW.incident_code IS NULL OR NEW.incident_code = '' THEN
    seq_num := NEXTVAL('public.incident_code_seq');
    NEW.incident_code := 'INC-' || TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYYMMDD') || '-' || LPAD((seq_num % 10000)::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_emergency_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  seq_num INTEGER;
BEGIN
  IF NEW.request_code IS NULL OR NEW.request_code = '' THEN
    seq_num := NEXTVAL('public.emergency_code_seq');
    NEW.request_code := 'ER-' || TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYYMMDD') || '-' || LPAD((seq_num % 10000)::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 4. CORE TABLES (12 Tables)
-- =============================================================================

-- 4.1 profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  phone TEXT DEFAULT '',
  preferred_language TEXT NOT NULL DEFAULT 'en'
    CHECK (preferred_language IN ('en', 'hi', 'te')),
  district TEXT NOT NULL DEFAULT 'East Godavari',
  locality TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'citizen'
    CHECK (role IN ('citizen', 'volunteer', 'rescue_team', 'admin')),
  volunteer_status TEXT NOT NULL DEFAULT 'none'
    CHECK (volunteer_status IN ('none', 'pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.2 shelters
CREATE TABLE IF NOT EXISTS public.shelters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  locality TEXT NOT NULL,
  district TEXT NOT NULL DEFAULT 'East Godavari',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity >= 0),
  current_occupancy INTEGER NOT NULL DEFAULT 0 CHECK (current_occupancy >= 0),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'near_capacity', 'full', 'closed')),
  amenities TEXT[] NOT NULL DEFAULT '{}',
  contact_officer_name TEXT DEFAULT '',
  info_origin TEXT NOT NULL DEFAULT 'admin_verified'
    CHECK (info_origin IN ('official_government', 'admin_verified')),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.3 incidents
CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_code TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'residential_flooding'
    CHECK (category IN (
      'residential_flooding',
      'road_waterlogging',
      'bridge_blockage',
      'embankment_breach',
      'drainage_overflow',
      'power_or_utility_hazard',
      'other'
    )),
  location_text TEXT NOT NULL,
  locality TEXT NOT NULL,
  district TEXT NOT NULL DEFAULT 'East Godavari',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  reviewed_priority TEXT
    CHECK (reviewed_priority IS NULL OR reviewed_priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'pending_verification'
    CHECK (status IN ('pending_verification', 'verified', 'rejected', 'duplicate')),
  info_origin TEXT NOT NULL DEFAULT 'citizen_submitted'
    CHECK (info_origin IN ('citizen_submitted', 'admin_verified', 'official_government', 'ai_suggested')),
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  contact_phone TEXT DEFAULT '',
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  ai_triage_note TEXT,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.4 rescue_teams
CREATE TABLE IF NOT EXISTS public.rescue_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  team_type TEXT NOT NULL DEFAULT 'boat_rescue'
    CHECK (team_type IN ('boat_rescue', 'medical_response', 'evacuation_transport', 'ndrf_sdrf_liaison', 'utility_clearance')),
  base_location TEXT NOT NULL,
  district TEXT NOT NULL DEFAULT 'East Godavari',
  capacity INTEGER NOT NULL DEFAULT 6 CHECK (capacity > 0),
  equipment_summary TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'deployed', 'standby', 'offline')),
  lead_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.5 emergency_requests (contains sensitive contact & medical info — strictly RLS-protected)
CREATE TABLE IF NOT EXISTS public.emergency_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_code TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requester_name TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL,
  people_count INTEGER NOT NULL DEFAULT 1 CHECK (people_count >= 1),
  children_count INTEGER NOT NULL DEFAULT 0 CHECK (children_count >= 0),
  elderly_count INTEGER NOT NULL DEFAULT 0 CHECK (elderly_count >= 0),
  vulnerable_count INTEGER NOT NULL DEFAULT 0 CHECK (vulnerable_count >= 0),
  medical_needs TEXT DEFAULT '',
  accessibility_needs TEXT DEFAULT '',
  description TEXT NOT NULL,
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  location_text TEXT NOT NULL,
  locality TEXT NOT NULL,
  district TEXT NOT NULL DEFAULT 'East Godavari',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  severity TEXT NOT NULL DEFAULT 'high'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  reviewed_priority TEXT
    CHECK (reviewed_priority IS NULL OR reviewed_priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'assigned', 'rescue_in_progress', 'resolved', 'closed', 'cancelled')),
  info_origin TEXT NOT NULL DEFAULT 'citizen_submitted'
    CHECK (info_origin IN ('citizen_submitted', 'admin_verified', 'official_government', 'ai_suggested')),
  assigned_team_id UUID REFERENCES public.rescue_teams(id) ON DELETE SET NULL,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.6 rescue_assignments
CREATE TABLE IF NOT EXISTS public.rescue_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emergency_request_id UUID NOT NULL REFERENCES public.emergency_requests(id) ON DELETE CASCADE,
  rescue_team_id UUID NOT NULL REFERENCES public.rescue_teams(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned', 'en_route', 'on_site', 'completed', 'reassigned')),
  notes TEXT DEFAULT '',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.7 volunteers
CREATE TABLE IF NOT EXISTS public.volunteers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  skills TEXT[] NOT NULL DEFAULT '{}',
  locality TEXT NOT NULL DEFAULT '',
  availability_status TEXT NOT NULL DEFAULT 'offline'
    CHECK (availability_status IN ('available', 'busy', 'offline')),
  approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.8 volunteer_tasks
CREATE TABLE IF NOT EXISTS public.volunteer_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  task_type TEXT NOT NULL DEFAULT 'field_support'
    CHECK (task_type IN ('field_support', 'shelter_registration', 'supply_distribution', 'road_check', 'community_outreach')),
  locality TEXT NOT NULL,
  shelter_id UUID REFERENCES public.shelters(id) ON DELETE SET NULL,
  assigned_volunteer_id UUID REFERENCES public.volunteers(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'assigned', 'in_progress', 'completed', 'cancelled')),
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.9 alerts (official / admin-verified bulletins with explicit source & publish time)
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  info_origin TEXT NOT NULL DEFAULT 'official_government'
    CHECK (info_origin IN ('official_government', 'admin_verified')),
  source_agency TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  affected_localities TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.10 notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info'
    CHECK (type IN ('info', 'incident_update', 'emergency_update', 'assignment', 'alert', 'approval')),
  related_entity_type TEXT,
  related_entity_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.11 incident_verification_history (audit trail)
CREATE TABLE IF NOT EXISTS public.incident_verification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  previous_priority TEXT,
  new_priority TEXT,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.12 rescue_status_history (audit trail)
CREATE TABLE IF NOT EXISTS public.rescue_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emergency_request_id UUID NOT NULL REFERENCES public.emergency_requests(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 5. INDEXES (status, created_at, lat/lng, user_id)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON public.incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_lat_lng ON public.incidents(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_incidents_user_id ON public.incidents(user_id);

CREATE INDEX IF NOT EXISTS idx_emergency_requests_status ON public.emergency_requests(status);
CREATE INDEX IF NOT EXISTS idx_emergency_requests_created_at ON public.emergency_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_requests_lat_lng ON public.emergency_requests(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_emergency_requests_user_id ON public.emergency_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_requests_assigned_team ON public.emergency_requests(assigned_team_id);

CREATE INDEX IF NOT EXISTS idx_rescue_teams_status ON public.rescue_teams(status);
CREATE INDEX IF NOT EXISTS idx_rescue_teams_lead_user_id ON public.rescue_teams(lead_user_id);

CREATE INDEX IF NOT EXISTS idx_rescue_assignments_request_id ON public.rescue_assignments(emergency_request_id);
CREATE INDEX IF NOT EXISTS idx_rescue_assignments_team_id ON public.rescue_assignments(rescue_team_id);
CREATE INDEX IF NOT EXISTS idx_rescue_assignments_status ON public.rescue_assignments(status);

CREATE INDEX IF NOT EXISTS idx_volunteers_user_id ON public.volunteers(user_id);
CREATE INDEX IF NOT EXISTS idx_volunteers_approval_status ON public.volunteers(approval_status);

CREATE INDEX IF NOT EXISTS idx_volunteer_tasks_status ON public.volunteer_tasks(status);
CREATE INDEX IF NOT EXISTS idx_volunteer_tasks_created_at ON public.volunteer_tasks(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_active_created ON public.alerts(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shelters_status_lat_lng ON public.shelters(status, latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_history_incident_id ON public.incident_verification_history(incident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rescue_history_request_id ON public.rescue_status_history(emergency_request_id, created_at DESC);

-- =============================================================================
-- 6. TRIGGERS (IDs, updated_at, Profile Auto-Creation, Role Guard, Audit Trails)
-- =============================================================================

-- Updated_at triggers
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_shelters_updated_at ON public.shelters;
CREATE TRIGGER trg_shelters_updated_at BEFORE UPDATE ON public.shelters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_incidents_updated_at ON public.incidents;
CREATE TRIGGER trg_incidents_updated_at BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_rescue_teams_updated_at ON public.rescue_teams;
CREATE TRIGGER trg_rescue_teams_updated_at BEFORE UPDATE ON public.rescue_teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_emergency_requests_updated_at ON public.emergency_requests;
CREATE TRIGGER trg_emergency_requests_updated_at BEFORE UPDATE ON public.emergency_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_rescue_assignments_updated_at ON public.rescue_assignments;
CREATE TRIGGER trg_rescue_assignments_updated_at BEFORE UPDATE ON public.rescue_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_volunteers_updated_at ON public.volunteers;
CREATE TRIGGER trg_volunteers_updated_at BEFORE UPDATE ON public.volunteers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_volunteer_tasks_updated_at ON public.volunteer_tasks;
CREATE TRIGGER trg_volunteer_tasks_updated_at BEFORE UPDATE ON public.volunteer_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_alerts_updated_at ON public.alerts;
CREATE TRIGGER trg_alerts_updated_at BEFORE UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Code generation triggers
DROP TRIGGER IF EXISTS trg_generate_incident_code ON public.incidents;
CREATE TRIGGER trg_generate_incident_code BEFORE INSERT ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.generate_incident_code();

DROP TRIGGER IF EXISTS trg_generate_emergency_code ON public.emergency_requests;
CREATE TRIGGER trg_generate_emergency_code BEFORE INSERT ON public.emergency_requests
  FOR EACH ROW EXECUTE FUNCTION public.generate_emergency_code();

-- RBAC Helper Functions (SECURITY DEFINER to avoid recursive RLS lookups)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Auto-create profile on auth.users signup — ALWAYS FORCED TO 'citizen'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wants_volunteer BOOLEAN;
  pref_lang TEXT;
  user_locality TEXT;
  user_district TEXT;
BEGIN
  wants_volunteer := COALESCE((NEW.raw_user_meta_data->>'requested_volunteer')::BOOLEAN, FALSE);
  pref_lang := CASE
    WHEN NEW.raw_user_meta_data->>'preferred_language' IN ('en', 'te')
      THEN NEW.raw_user_meta_data->>'preferred_language'
    ELSE 'en'
  END;
  user_locality := COALESCE(NEW.raw_user_meta_data->>'locality', '');
  user_district := COALESCE(NULLIF(NEW.raw_user_meta_data->>'district', ''), 'East Godavari');

  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    phone,
    preferred_language,
    district,
    locality,
    role,
    volunteer_status
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    pref_lang,
    user_district,
    user_locality,
    'citizen', -- Role is strictly forced to 'citizen' on self-registration
    CASE WHEN wants_volunteer THEN 'pending' ELSE 'none' END
  )
  ON CONFLICT (id) DO NOTHING;

  -- If user applied as volunteer, register pending volunteer application
  IF wants_volunteer THEN
    INSERT INTO public.volunteers (user_id, locality, approval_status)
    VALUES (NEW.id, user_locality, 'pending')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Prevent users from changing their own role or volunteer_status
CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow direct SQL Editor / postgres service-role migrations where auth.uid() is NULL
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.volunteer_status IS DISTINCT FROM OLD.volunteer_status)
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: Only an administrator may change user roles or volunteer approval status.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_self_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_escalation();

-- Audit Trail Trigger: Incident Verification & Priority History
CREATE OR REPLACE FUNCTION public.log_incident_verification_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.reviewed_priority IS DISTINCT FROM OLD.reviewed_priority THEN
    INSERT INTO public.incident_verification_history (
      incident_id,
      changed_by,
      previous_status,
      new_status,
      previous_priority,
      new_priority,
      notes
    ) VALUES (
      NEW.id,
      auth.uid(),
      OLD.status,
      NEW.status,
      OLD.reviewed_priority,
      NEW.reviewed_priority,
      CASE
        WHEN NEW.status = 'verified' THEN 'Status verified by reviewer'
        ELSE 'Incident verification metadata updated'
      END
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_incident_verification ON public.incidents;
CREATE TRIGGER trg_log_incident_verification
  AFTER UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.log_incident_verification_change();

-- Audit Trail Trigger: Rescue Request Status History
CREATE OR REPLACE FUNCTION public.log_rescue_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.rescue_status_history (
      emergency_request_id,
      changed_by,
      previous_status,
      new_status,
      notes
    ) VALUES (
      NEW.id,
      auth.uid(),
      OLD.status,
      NEW.status,
      'Emergency request status transitioned'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_rescue_status ON public.emergency_requests;
CREATE TRIGGER trg_log_rescue_status
  AFTER UPDATE ON public.emergency_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_rescue_status_change();

-- =============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rescue_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rescue_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shelters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_verification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rescue_status_history ENABLE ROW LEVEL SECURITY;

-- 7.1 profiles policies
CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users update own profile without role change"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (
      auth.uid() = id
      AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
      AND volunteer_status = (SELECT p.volunteer_status FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

-- 7.2 incidents policies
CREATE POLICY "Public can read verified incidents"
  ON public.incidents FOR SELECT
  USING (status = 'verified');

CREATE POLICY "Reporters read own incidents"
  ON public.incidents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all incidents"
  ON public.incidents FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Authenticated users create own citizen-submitted incidents"
  ON public.incidents FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending_verification'
    AND info_origin = 'citizen_submitted'
  );

CREATE POLICY "Reporters update own pending incidents"
  ON public.incidents FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending_verification')
  WITH CHECK (auth.uid() = user_id AND status = 'pending_verification');

CREATE POLICY "Admins full write on incidents"
  ON public.incidents FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 7.3 emergency_requests policies (STRICT PRIVACY: NEVER PUBLICLY READABLE)
CREATE POLICY "Requesters read own emergency requests"
  ON public.emergency_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Rescue teams read only assigned emergency requests"
  ON public.emergency_requests FOR SELECT
  USING (
    public.get_my_role() = 'rescue_team'
    AND EXISTS (
      SELECT 1
      FROM public.rescue_assignments ra
      JOIN public.rescue_teams rt ON rt.id = ra.rescue_team_id
      WHERE ra.emergency_request_id = emergency_requests.id
        AND rt.lead_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins full access to emergency requests"
  ON public.emergency_requests FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Authenticated citizens create own emergency requests"
  ON public.emergency_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Requesters can cancel own pending emergency requests"
  ON public.emergency_requests FOR UPDATE
  USING (auth.uid() = user_id AND status IN ('pending', 'verified'))
  WITH CHECK (auth.uid() = user_id AND status = 'cancelled');

CREATE POLICY "Assigned rescue team updates active rescue status"
  ON public.emergency_requests FOR UPDATE
  USING (
    public.get_my_role() = 'rescue_team'
    AND EXISTS (
      SELECT 1
      FROM public.rescue_assignments ra
      JOIN public.rescue_teams rt ON rt.id = ra.rescue_team_id
      WHERE ra.emergency_request_id = emergency_requests.id
        AND rt.lead_user_id = auth.uid()
    )
  )
  WITH CHECK (status IN ('assigned', 'rescue_in_progress', 'resolved'));

-- 7.4 rescue_teams policies
CREATE POLICY "Rescue leads read own team"
  ON public.rescue_teams FOR SELECT
  USING (lead_user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins manage rescue teams"
  ON public.rescue_teams FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Rescue leads update own team readiness"
  ON public.rescue_teams FOR UPDATE
  USING (lead_user_id = auth.uid())
  WITH CHECK (lead_user_id = auth.uid());

-- 7.5 rescue_assignments policies
CREATE POLICY "Rescue leads read own assignments"
  ON public.rescue_assignments FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.rescue_teams rt
      WHERE rt.id = rescue_assignments.rescue_team_id
        AND rt.lead_user_id = auth.uid()
    )
  );

CREATE POLICY "Rescue leads update own assignments"
  ON public.rescue_assignments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.rescue_teams rt
      WHERE rt.id = rescue_assignments.rescue_team_id
        AND rt.lead_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage rescue assignments"
  ON public.rescue_assignments FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 7.6 volunteers policies
CREATE POLICY "Volunteers read own record"
  ON public.volunteers FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users apply as pending volunteer"
  ON public.volunteers FOR INSERT
  WITH CHECK (auth.uid() = user_id AND approval_status = 'pending');

CREATE POLICY "Volunteers update own availability and skills"
  ON public.volunteers FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND approval_status = (SELECT v.approval_status FROM public.volunteers v WHERE v.user_id = auth.uid())
  );

CREATE POLICY "Admins manage all volunteers"
  ON public.volunteers FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 7.7 volunteer_tasks policies
CREATE POLICY "Approved volunteers read open or assigned tasks"
  ON public.volunteer_tasks FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.volunteers v
      WHERE v.user_id = auth.uid() AND v.approval_status = 'approved'
    )
  );

CREATE POLICY "Assigned volunteer updates own task status"
  ON public.volunteer_tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.volunteers v
      WHERE v.id = volunteer_tasks.assigned_volunteer_id
        AND v.user_id = auth.uid()
        AND v.approval_status = 'approved'
    )
  );

CREATE POLICY "Admins manage volunteer tasks"
  ON public.volunteer_tasks FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 7.8 alerts policies (active alerts publicly readable)
CREATE POLICY "Public reads active alerts"
  ON public.alerts FOR SELECT
  USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "Admins manage alerts"
  ON public.alerts FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 7.9 shelters policies (publicly readable)
CREATE POLICY "Public reads shelters"
  ON public.shelters FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins manage shelters"
  ON public.shelters FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 7.10 notifications policies
CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users mark own notifications read"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (public.is_admin());

-- 7.11 Audit history policies
CREATE POLICY "Admins read incident verification history"
  ON public.incident_verification_history FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins insert incident verification history"
  ON public.incident_verification_history FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins and assigned rescue leads read rescue history"
  ON public.rescue_status_history FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.rescue_assignments ra
      JOIN public.rescue_teams rt ON rt.id = ra.rescue_team_id
      WHERE ra.emergency_request_id = rescue_status_history.emergency_request_id
        AND rt.lead_user_id = auth.uid()
    )
  );

-- =============================================================================
-- 8. STORAGE BUCKET ("incident-photos", <= 5MB, image MIME validation)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'incident-photos',
  'incident-photos',
  TRUE,
  5242880, -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS Policies for incident-photos
DROP POLICY IF EXISTS "Public view incident photos" ON storage.objects;
CREATE POLICY "Public view incident photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'incident-photos');

DROP POLICY IF EXISTS "Authenticated users upload own incident photos" ON storage.objects;
CREATE POLICY "Authenticated users upload own incident photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'incident-photos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "Users or admins delete own incident photos" ON storage.objects;
CREATE POLICY "Users or admins delete own incident photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'incident-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR public.is_admin()
    )
  );

-- =============================================================================
-- 9. SUPABASE REALTIME PUBLICATION
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'incidents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'emergency_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_requests;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- =============================================================================
-- 10. STAGE 4 ADDITIONS: OFFICIAL INFORMATION & REALTIME NOTIFICATIONS RLS
-- =============================================================================

-- Official Information entries (rainfall, weather forecasts, Godavari river levels).
-- Empty by default; UI displays "Live official data is currently unavailable." until
-- a District Admin manually publishes a sourced entry with publication timestamp.
CREATE TABLE IF NOT EXISTS public.official_information (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (
    category IN ('rainfall', 'forecast', 'river_level', 'general_advisory')
  ),
  title TEXT NOT NULL,
  metric_value TEXT DEFAULT '',
  station_or_area TEXT NOT NULL DEFAULT 'East Godavari',
  summary TEXT NOT NULL,
  source_agency TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  info_origin TEXT NOT NULL DEFAULT 'official_government' CHECK (
    info_origin = 'official_government'
  ),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_official_info_category ON public.official_information (category);
CREATE INDEX IF NOT EXISTS idx_official_info_active ON public.official_information (is_active, published_at DESC);

DROP TRIGGER IF EXISTS trg_official_info_updated_at ON public.official_information;
CREATE TRIGGER trg_official_info_updated_at BEFORE UPDATE ON public.official_information
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.official_information ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads active official information" ON public.official_information;
CREATE POLICY "Public reads active official information"
  ON public.official_information FOR SELECT
  USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage official information" ON public.official_information;
CREATE POLICY "Admins manage official information"
  ON public.official_information FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Allow authenticated users to insert own submission receipt notifications
DROP POLICY IF EXISTS "Users insert own notifications" ON public.notifications;
CREATE POLICY "Users insert own notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow assigned rescue leads to notify the citizen on rescue progress / resolution
DROP POLICY IF EXISTS "Assigned rescue leads notify requester" ON public.notifications;
CREATE POLICY "Assigned rescue leads notify requester"
  ON public.notifications FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'rescue_team'
    AND related_entity_type = 'emergency_request'
    AND EXISTS (
      SELECT 1
      FROM public.emergency_requests er
      JOIN public.rescue_assignments ra ON ra.emergency_request_id = er.id
      JOIN public.rescue_teams rt ON rt.id = ra.rescue_team_id
      WHERE er.id = notifications.related_entity_id
        AND er.user_id = notifications.user_id
        AND rt.lead_user_id = auth.uid()
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'official_information'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.official_information;
  END IF;
END $$;

