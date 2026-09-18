-- Allow undated backlog tasks (null task_date = backlog)
ALTER TABLE public.tasks
  ALTER COLUMN task_date DROP NOT NULL,
  ALTER COLUMN task_date DROP DEFAULT;
