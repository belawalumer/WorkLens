-- Add date range columns for on_leave / vacation statuses
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS status_from  date,
  ADD COLUMN IF NOT EXISTS status_until date;
