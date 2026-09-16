-- Migration 006: WhatsApp, app_settings, leave_records, public_holidays, holiday_assignments

-- ── profiles: WhatsApp contact ────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS whatsapp text;

-- ── app_settings ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);

INSERT INTO app_settings (key, value)
VALUES ('leverage_hours', '176')
ON CONFLICT (key) DO NOTHING;

-- ── leave_records ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_records (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  leave_date   date NOT NULL,
  leave_type   text NOT NULL CHECK (leave_type IN ('full', 'half_morning', 'half_afternoon')),
  note         text,
  created_by   uuid REFERENCES profiles(id),
  created_at   timestamptz DEFAULT now()
);

-- ── public_holidays ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public_holidays (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now()
);

-- Fix old installs that used "date" instead of "holiday_date":
-- If only "date" exists → rename it. If both exist → drop the stale "date" column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'public_holidays' AND column_name = 'date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'public_holidays' AND column_name = 'holiday_date'
  ) THEN
    ALTER TABLE public_holidays RENAME COLUMN "date" TO holiday_date;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'public_holidays' AND column_name = 'date'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'public_holidays' AND column_name = 'holiday_date'
  ) THEN
    ALTER TABLE public_holidays DROP COLUMN "date";
  END IF;
END $$;

-- Add columns separately so re-runs on a pre-existing table are safe
ALTER TABLE public_holidays ADD COLUMN IF NOT EXISTS holiday_date date NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public_holidays ADD COLUMN IF NOT EXISTS name         text NOT NULL DEFAULT '';

-- Drop the defaults now that the columns exist (new rows always supply values)
ALTER TABLE public_holidays ALTER COLUMN holiday_date DROP DEFAULT;
ALTER TABLE public_holidays ALTER COLUMN name         DROP DEFAULT;

-- ── holiday_assignments ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS holiday_assignments (
  holiday_id   uuid NOT NULL REFERENCES public_holidays(id) ON DELETE CASCADE,
  developer_id uuid NOT NULL REFERENCES profiles(id)        ON DELETE CASCADE,
  PRIMARY KEY (holiday_id, developer_id)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE app_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_holidays    ENABLE ROW LEVEL SECURITY;
ALTER TABLE holiday_assignments ENABLE ROW LEVEL SECURITY;

-- app_settings
DROP POLICY IF EXISTS "read settings"  ON app_settings;
DROP POLICY IF EXISTS "write settings" ON app_settings;
CREATE POLICY "read settings"  ON app_settings FOR SELECT USING (true);
CREATE POLICY "write settings" ON app_settings
  FOR ALL
  USING     (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- leave_records
DROP POLICY IF EXISTS "read leaves"   ON leave_records;
DROP POLICY IF EXISTS "manage leaves" ON leave_records;
CREATE POLICY "read leaves" ON leave_records FOR SELECT USING (true);
CREATE POLICY "manage leaves" ON leave_records
  FOR ALL
  USING     (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hr_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hr_admin')));

-- public_holidays
DROP POLICY IF EXISTS "read holidays"   ON public_holidays;
DROP POLICY IF EXISTS "manage holidays" ON public_holidays;
CREATE POLICY "read holidays" ON public_holidays FOR SELECT USING (true);
CREATE POLICY "manage holidays" ON public_holidays
  FOR ALL
  USING     (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hr_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hr_admin')));

-- holiday_assignments
DROP POLICY IF EXISTS "read assignments"   ON holiday_assignments;
DROP POLICY IF EXISTS "manage assignments" ON holiday_assignments;
CREATE POLICY "read assignments" ON holiday_assignments FOR SELECT USING (true);
CREATE POLICY "manage assignments" ON holiday_assignments
  FOR ALL
  USING     (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
