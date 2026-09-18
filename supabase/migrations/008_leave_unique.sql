-- Add unique constraint so upsert/ON CONFLICT works correctly
-- and prevents duplicate leave records for the same dev + date
ALTER TABLE leave_records
  DROP CONSTRAINT IF EXISTS leave_records_developer_date_unique;

ALTER TABLE leave_records
  ADD CONSTRAINT leave_records_developer_date_unique
  UNIQUE (developer_id, leave_date);
