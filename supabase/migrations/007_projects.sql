-- Migration 007: Unique project names + delete policy

-- Case-insensitive unique constraint on project names
CREATE UNIQUE INDEX IF NOT EXISTS projects_name_unique ON public.projects (lower(name));

-- Allow admins to delete projects (previously no delete policy existed)
DROP POLICY IF EXISTS "projects_delete" ON public.projects;
CREATE POLICY "projects_delete" ON public.projects
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hr_admin')));
