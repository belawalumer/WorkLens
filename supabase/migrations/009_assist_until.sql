-- Timed "available to assist" signal on resource cards
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS assist_until timestamptz;

-- Needed so Realtime UPDATE payloads include old.assist_until (for notify-once logic)
ALTER TABLE profiles REPLICA IDENTITY FULL;
