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

-- Unique constraint so upsert/ON CONFLICT works and duplicates are prevented
ALTER TABLE leave_records
  DROP CONSTRAINT IF EXISTS leave_records_developer_date_unique;

ALTER TABLE leave_records
  ADD CONSTRAINT leave_records_developer_date_unique
  UNIQUE (developer_id, leave_date);
