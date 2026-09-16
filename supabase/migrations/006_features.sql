-- WhatsApp contact on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS whatsapp text;

-- App-wide settings (key/value store)
CREATE TABLE IF NOT EXISTS app_settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);

-- Default leverage hours: 176h/month (8h/day × 22 working days)
INSERT INTO app_settings (key, value)
VALUES ('leverage_hours', '176')
ON CONFLICT (key) DO NOTHING;

-- Leave records with half-day support
CREATE TABLE IF NOT EXISTS leave_records (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  leave_date   date NOT NULL,
  leave_type   text NOT NULL CHECK (leave_type IN ('full', 'half_morning', 'half_afternoon')),
  note         text,
  created_by   uuid REFERENCES profiles(id),
  created_at   timestamptz DEFAULT now()
);

-- Public holidays
CREATE TABLE IF NOT EXISTS public_holidays (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL,
  name         text NOT NULL,
  created_at   timestamptz DEFAULT now()
);

-- Holiday assignments — if no rows exist for a holiday it applies to everyone
CREATE TABLE IF NOT EXISTS holiday_assignments (
  holiday_id   uuid NOT NULL REFERENCES public_holidays(id) ON DELETE CASCADE,
  developer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (holiday_id, developer_id)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read settings" ON app_settings;
DROP POLICY IF EXISTS "write settings" ON app_settings;
CREATE POLICY "read settings"  ON app_settings FOR SELECT USING (true);
CREATE POLICY "write settings" ON app_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

ALTER TABLE leave_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read leaves"   ON leave_records;
DROP POLICY IF EXISTS "manage leaves" ON leave_records;
CREATE POLICY "read leaves"   ON leave_records FOR SELECT USING (true);
CREATE POLICY "manage leaves" ON leave_records FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hr_admin'))
);

ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read holidays"   ON public_holidays;
DROP POLICY IF EXISTS "manage holidays" ON public_holidays;
CREATE POLICY "read holidays"   ON public_holidays FOR SELECT USING (true);
CREATE POLICY "manage holidays" ON public_holidays FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

ALTER TABLE holiday_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read assignments"   ON holiday_assignments;
DROP POLICY IF EXISTS "manage assignments" ON holiday_assignments;
CREATE POLICY "read assignments"   ON holiday_assignments FOR SELECT USING (true);
CREATE POLICY "manage assignments" ON holiday_assignments FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);
