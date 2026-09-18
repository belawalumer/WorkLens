-- Migration 010: Add SQA and UI/UX roles, treated as developer-level access

-- Expand role check constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'hr_admin', 'developer', 'sqa', 'ui_ux'));

-- Update profiles_select to include sqa and ui_ux in dev-tier visibility
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (
  id = auth.uid()
  OR CASE public.get_my_role()
    WHEN 'super_admin' THEN true
    WHEN 'hr_admin'    THEN role IN ('developer', 'hr_admin', 'sqa', 'ui_ux')
    ELSE role IN ('developer', 'sqa', 'ui_ux')
  END
);

-- Update tasks_select
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated USING (
  CASE public.get_my_role()
    WHEN 'super_admin' THEN true
    WHEN 'hr_admin'    THEN (SELECT role FROM public.profiles WHERE id = developer_id) IN ('developer', 'hr_admin', 'sqa', 'ui_ux')
    ELSE (SELECT role FROM public.profiles WHERE id = developer_id) IN ('developer', 'sqa', 'ui_ux')
  END
);

-- Update developer_roles select
DROP POLICY IF EXISTS "roles_select" ON public.developer_roles;
CREATE POLICY "roles_select" ON public.developer_roles FOR SELECT TO authenticated USING (
  CASE public.get_my_role()
    WHEN 'super_admin' THEN true
    WHEN 'hr_admin'    THEN (SELECT role FROM public.profiles WHERE id = developer_id) IN ('developer', 'hr_admin', 'sqa', 'ui_ux')
    ELSE (SELECT role FROM public.profiles WHERE id = developer_id) IN ('developer', 'sqa', 'ui_ux')
  END
);
