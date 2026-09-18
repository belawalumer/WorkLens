-- Rename 'date' → 'leave_date' if the column was created with the old name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leave_records' AND column_name = 'date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leave_records' AND column_name = 'leave_date'
  ) THEN
    ALTER TABLE leave_records RENAME COLUMN "date" TO leave_date;
  END IF;
END $$;

-- Ensure all expected columns exist (table may have been created with a minimal schema)
ALTER TABLE leave_records
  ADD COLUMN IF NOT EXISTS leave_type  text NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS note        text,
  ADD COLUMN IF NOT EXISTS created_by  uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now();

-- Add the check constraint on leave_type if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'leave_records' AND column_name = 'leave_type'
      AND constraint_name = 'leave_records_leave_type_check'
  ) THEN
    ALTER TABLE leave_records
      ADD CONSTRAINT leave_records_leave_type_check
      CHECK (leave_type IN ('full', 'half_morning', 'half_afternoon'));
  END IF;
END $$;

-- Drop the DEFAULT now that the column is guaranteed to exist
ALTER TABLE leave_records ALTER COLUMN leave_type DROP DEFAULT;

-- Unique constraint so upsert/ON CONFLICT works and duplicates are prevented
ALTER TABLE leave_records
  DROP CONSTRAINT IF EXISTS leave_records_developer_date_unique;

ALTER TABLE leave_records
  ADD CONSTRAINT leave_records_developer_date_unique
  UNIQUE (developer_id, leave_date);
